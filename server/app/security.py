"""密码哈希、会话签发与当前账户依赖。"""
from __future__ import annotations

import hashlib
import hmac
import re
import secrets
import struct
import subprocess
from datetime import timedelta

from fastapi import Depends, Request, Response
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from . import config, models, times
from .database import get_db
from .errors import ApiError


def _pbkdf2_hmac(algorithm: str, password: bytes, salt: bytes, iterations: int, dklen: int | None = None) -> bytes:
    native = getattr(hashlib, "pbkdf2_hmac", None)
    if native is not None:
        return native(algorithm, password, salt, iterations, dklen)
    if algorithm.lower() == "sha256":
        try:
            import ctypes
            from ctypes import wintypes

            bcrypt = ctypes.WinDLL("bcrypt")
            handle = ctypes.c_void_p()
            bcrypt.BCryptOpenAlgorithmProvider.argtypes = [ctypes.POINTER(ctypes.c_void_p), wintypes.LPCWSTR, wintypes.LPCWSTR, wintypes.ULONG]
            bcrypt.BCryptOpenAlgorithmProvider.restype = wintypes.LONG
            bcrypt.BCryptDeriveKeyPBKDF2.argtypes = [ctypes.c_void_p, ctypes.c_void_p, wintypes.ULONG, ctypes.c_void_p, wintypes.ULONG, ctypes.c_ulonglong, ctypes.c_void_p, wintypes.ULONG, wintypes.ULONG]
            bcrypt.BCryptDeriveKeyPBKDF2.restype = wintypes.LONG
            bcrypt.BCryptCloseAlgorithmProvider.argtypes = [ctypes.c_void_p, wintypes.ULONG]
            bcrypt.BCryptCloseAlgorithmProvider.restype = wintypes.LONG
            status = bcrypt.BCryptOpenAlgorithmProvider(ctypes.byref(handle), "SHA256", None, 0x00000008)
            if status == 0:
                try:
                    length = len(hashlib.sha256().digest()) if dklen is None else int(dklen)
                    output = ctypes.create_string_buffer(length)
                    password_buffer = ctypes.create_string_buffer(password, len(password))
                    salt_buffer = ctypes.create_string_buffer(salt, len(salt))
                    status = bcrypt.BCryptDeriveKeyPBKDF2(handle, password_buffer, len(password), salt_buffer, len(salt), int(iterations), output, length, 0)
                    if status == 0:
                        return output.raw
                finally:
                    bcrypt.BCryptCloseAlgorithmProvider(handle, 0)
        except (AttributeError, ImportError, OSError):
            pass
    try:
        length = len(hashlib.sha256().digest()) if dklen is None else int(dklen)
        completed = subprocess.run(
            [
                "openssl", "kdf", "-keylen", str(length),
                "-kdfopt", "digest:" + algorithm.upper(),
                "-kdfopt", "hexpass:" + password.hex(),
                "-kdfopt", "hexsalt:" + salt.hex(),
                "-kdfopt", "iter:" + str(int(iterations)),
                "PBKDF2",
            ],
            capture_output=True,
            check=False,
            text=True,
        )
        if completed.returncode == 0:
            value = completed.stdout.strip().replace(":", "")
            if len(value) == length * 2:
                return bytes.fromhex(value)
    except (OSError, ValueError):
        pass
    probe = hashlib.new(algorithm)
    digest_size = probe.digest_size
    block_size = probe.block_size
    if len(password) > block_size:
        password = hashlib.new(algorithm, password).digest()
    normalized_key = password.ljust(block_size, b"\0")
    inner_pad = bytes(value ^ 0x36 for value in normalized_key)
    outer_pad = bytes(value ^ 0x5C for value in normalized_key)

    def mac(message: bytes) -> bytes:
        inner = hashlib.new(algorithm)
        inner.update(inner_pad)
        inner.update(message)
        outer = hashlib.new(algorithm)
        outer.update(outer_pad)
        outer.update(inner.digest())
        return outer.digest()

    length = digest_size if dklen is None else int(dklen)
    blocks = max(1, (length + digest_size - 1) // digest_size)
    output = bytearray()
    for block_index in range(1, blocks + 1):
        current = mac(salt + struct.pack(">I", block_index))
        accumulated = bytearray(current)
        for _ in range(1, int(iterations)):
            current = mac(current)
            for index, value in enumerate(current):
                accumulated[index] ^= value
        output.extend(accumulated)
    return bytes(output[:length])


def validate_username(username: str) -> str:
    value = (username or "").strip()
    if len(value) < config.USERNAME_MIN or len(value) > config.USERNAME_MAX:
        raise ApiError(422, "invalid_username", "用户名需要 2 到 16 个字符")
    if not re.match(config.USERNAME_PATTERN, value):
        raise ApiError(422, "invalid_username", "用户名只能使用中文、字母、数字与下划线")
    return value


def validate_password(password: str) -> str:
    value = password or ""
    if len(value) < config.PASSWORD_MIN or len(value) > config.PASSWORD_MAX:
        raise ApiError(422, "invalid_password", "密码需要 6 到 64 个字符")
    return value


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = _pbkdf2_hmac(config.PBKDF2_ALGORITHM, password.encode("utf-8"), salt, config.PBKDF2_ITERATIONS)
    return "{}${}${}${}".format(config.PBKDF2_PREFIX, config.PBKDF2_ITERATIONS, salt.hex(), digest.hex())


def verify_password(password: str, stored: str) -> bool:
    try:
        algorithm, iterations, salt_hex, digest_hex = (stored or "").split("$")
        if algorithm != config.PBKDF2_PREFIX:
            return False
        digest = _pbkdf2_hmac(
            config.PBKDF2_ALGORITHM,
            (password or "").encode("utf-8"),
            bytes.fromhex(salt_hex),
            int(iterations),
        )
    except (ValueError, TypeError):
        return False
    return hmac.compare_digest(digest.hex(), digest_hex)


def token_hash(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def purge_expired(db: Session) -> None:
    db.execute(delete(models.LoginSession).where(models.LoginSession.expires_at < times.now()))
    db.commit()


def find_account(db: Session, username: str) -> models.Account | None:
    if not username:
        return None
    return db.execute(select(models.Account).where(models.Account.username == username)).scalar_one_or_none()


def _write_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        config.SESSION_COOKIE,
        token,
        max_age=config.SESSION_DAYS * 86400,
        httponly=True,
        samesite="strict",
        path="/",
    )


def start_session(db: Session, account: models.Account, response: Response) -> None:
    token = secrets.token_urlsafe(32)
    now = times.now()
    db.add(
        models.LoginSession(
            token_hash=token_hash(token),
            account_id=account.id,
            created_at=now,
            expires_at=now + timedelta(days=config.SESSION_DAYS),
        )
    )
    account.last_login_at = now
    db.commit()
    _write_cookie(response, token)


def end_session(db: Session, request: Request, response: Response) -> None:
    token = request.cookies.get(config.SESSION_COOKIE)
    if token:
        db.execute(delete(models.LoginSession).where(models.LoginSession.token_hash == token_hash(token)))
        db.commit()
    response.delete_cookie(config.SESSION_COOKIE, path="/")


def current_account(request: Request, response: Response, db: Session = Depends(get_db)) -> models.Account:
    token = request.cookies.get(config.SESSION_COOKIE)
    if not token:
        raise ApiError(401, "not_authenticated", "尚未登录")
    login = db.get(models.LoginSession, token_hash(token))
    now = times.now()
    if login is None or login.expires_at < now:
        if login is not None:
            db.delete(login)
            db.commit()
        raise ApiError(401, "not_authenticated", "登录已过期，请重新登录")
    if login.expires_at - now < timedelta(days=config.SESSION_RENEW_DAYS):
        login.expires_at = now + timedelta(days=config.SESSION_DAYS)
        db.commit()
        _write_cookie(response, token)
    account = db.get(models.Account, login.account_id)
    if account is None:
        raise ApiError(401, "not_authenticated", "账户不存在")
    return account
