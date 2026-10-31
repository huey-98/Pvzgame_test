/* 输入层：将鼠标/触控事件转换为游戏动作。 */
(function (Game) {
  "use strict";
  var C = Game.config, S = Game.state, canvas = null, inputBound = false, inputCleanups = [];

  function addInputListener(target, type, handler, options) {
    if (!target || !target.addEventListener) return;
    target.addEventListener(type, handler, options);
    inputCleanups.push(function () { target.removeEventListener(type, handler, options); });
  }

  Game.pointerPosition = function (event) {
    if (!canvas) return { x: 0, y: 0 };
    var rect = canvas.getBoundingClientRect();
    return { x: (event.clientX - rect.left) * C.width / rect.width, y: (event.clientY - rect.top) * C.height / rect.height };
  };

  function pointInRect(point, rect) {
    return !!rect && point.x >= rect.x && point.x <= rect.x + rect.w && point.y >= rect.y && point.y <= rect.y + rect.h;
  }

  function pointInCircle(point, circle) {
    if (!circle) return false;
    var dx = point.x - circle.x, dy = point.y - circle.y;
    return dx * dx + dy * dy <= circle.r * circle.r;
  }

  function getSkillCodexGroup() {
    if (!S.selectedSkillCodexId) return null;
    return Game.getSkillGroups().find(function (group) { return group.id === S.selectedSkillCodexId; });
  }
  function getCodexPageCount(screen) {
    if (screen === "zombieCodex") {
      var count = Game.getCodexEnemyIds(S.zombieCodexCategory).length;
      return Math.max(1, Math.ceil(count / 4));
    }
    var group = getSkillCodexGroup();
    if (group) {
      var core = (C.skillProgress.order || []).indexOf(group.id) >= 0;
      return Math.max(1, Math.ceil(group.traits.length / (core ? 2 : 3)));
    }
    return Math.max(1, Math.ceil(Game.getSkillGroups().length / C.skillCodexUI.cards.perPage));
  }

  function handleCodexPointer(point, screen) {
    if (screen === "zombieCodex" && point.y >= 107 && point.y <= 138 && point.x >= 22 && point.x <= 336) {
      var categories = ["minion", "elite", "boss"], categoryIndex = Math.floor((point.x - 22) / 106);
      if (categories[categoryIndex]) { S.zombieCodexCategory = categories[categoryIndex]; S.selectedZombieCodexId = null; S.codexPage = 0; }
      return;
    }
    if (screen === "skillCodex") {
      var group = getSkillCodexGroup();
      if (group) {
        if ((C.skillProgress.order || []).indexOf(group.id) >= 0 && pointInRect(point, Game.getSkillCodexProgressActionRect())) {
          var view = Game.skillProgress ? Game.skillProgress.getView(group.id) : null;
          var resources = Game.accounts.getResources(), cost = view && view.nextCost, affordable = !view || !cost || ((resources.coin || 0) >= (cost.coin || 0) && (resources[view.blueprintId] || 0) >= (cost[view.blueprintId] || 0));
          if (Game.accounts.getStatus() === "ready" && !Game.accounts.state.skillBusy && view && view.level < view.maxLevel && affordable) Game.upgradeSkill(group.id);
          return;
        }
        if (pointInRect(point, Game.getSkillCodexPagerRect("prev")) && getCodexPageCount(screen) > 1) {
          S.codexPage = Math.max(0, S.codexPage - 1);
          return;
        }
        if (pointInRect(point, Game.getSkillCodexPagerRect("next")) && getCodexPageCount(screen) > 1) {
          S.codexPage = Math.min(getCodexPageCount(screen) - 1, S.codexPage + 1);
          return;
        }
        if (pointInRect(point, Game.getSkillCodexBackRect())) { S.selectedSkillCodexId = null; S.codexPage = 0; }
        return;
      }
      var skillIndex = Game.getSkillCodexCardIndex(point);
      if (skillIndex >= 0) {
        var skillList = Game.getSkillGroups(), skillPageNumber = S.codexPage || 0, skillPer = C.skillCodexUI.cards.perPage;
        var selectedSkill = skillList.slice(skillPageNumber * skillPer, skillPageNumber * skillPer + skillPer)[skillIndex];
        if (selectedSkill) { S.selectedSkillCodexId = selectedSkill.id; S.codexPage = 0; }
        return;
      }
    }
    if (screen === "zombieCodex" && S.selectedZombieCodexId) {
      if (point.x >= 98 && point.x <= 262 && point.y >= 553 && point.y <= 593) S.selectedZombieCodexId = null;
      return;
    }
    if (point.y >= 521 && point.y <= 552 && getCodexPageCount(screen) > 1) {
      if (point.x >= 94 && point.x <= 148) S.codexPage = Math.max(0, S.codexPage - 1);
      else if (point.x >= 212 && point.x <= 266) S.codexPage = Math.min(getCodexPageCount(screen) - 1, S.codexPage + 1);
      return;
    }
    if (screen === "zombieCodex") {
      var column = point.x >= 26 && point.x <= 174 ? 0 : point.x >= 186 && point.x <= 334 ? 1 : -1;
      var row = point.y >= 155 && point.y <= 303 ? 0 : point.y >= 315 && point.y <= 463 ? 1 : -1;
      if (column >= 0 && row >= 0) {
        var entryIds = Game.getCodexEnemyIds(S.zombieCodexCategory);
        var entryId = entryIds[(S.codexPage || 0) * 4 + row * 2 + column];
        if (entryId) S.selectedZombieCodexId = entryId;
        return;
      }
    }
    if (point.x >= 108 && point.x <= 252 && point.y >= 561 && point.y <= 598) Game.backToMenu();
  }

  function bindTestButton(id, action) {
    var button = document.getElementById(id);
    if (button) addInputListener(button, "click", function (event) { event.preventDefault(); action(); });
  }

  var slotHoldTimer = null, slotHoldId = null;

  function isInSkillSlotColumn(point) {
    var slots = C.skillSlots;
    if (!slots) return false;
    var left = C.width + slots.offsetX;
    return point.x >= left - 6 && point.x <= left + slots.width + 6 && point.y >= slots.y - 4 && point.y <= slots.y + C.maxSkillSlots * (slots.height + slots.gap);
  }

  function getSkillSlotAt(point) {
    var slots = C.skillSlots;
    if (!slots || !S.player) return null;
    var left = C.width + slots.offsetX;
    if (point.x < left - 6 || point.x > left + slots.width + 6) return null;
    var order = S.player.skillOrder || [];
    for (var slot = 0; slot < C.maxSkillSlots; slot++) {
      var y = slots.y + slot * (slots.height + slots.gap);
      if (point.y >= y - 4 && point.y <= y + slots.height + 4) return order[slot] || null;
    }
    return null;
  }

  function releaseSkillSlot() {
    if (slotHoldTimer) { clearTimeout(slotHoldTimer); slotHoldTimer = null; }
    slotHoldId = null;
    if (S.skillRangePreview) S.skillRangePreview = null;
  }

  function holdSkillSlot(point) {
    var id = getSkillSlotAt(point);
    releaseSkillSlot();
    if (!id) return;
    slotHoldId = id;
    slotHoldTimer = setTimeout(function () {
      slotHoldTimer = null;
      if (slotHoldId) S.skillRangePreview = slotHoldId;
    }, C.skillRangeHoldMs || 350);
  }

  Game.initializeInput = function (nextCanvas) {
    if (inputBound) Game.destroyInput();
    canvas = nextCanvas || canvas;
    inputBound = true;
    if (!canvas || !canvas.addEventListener) return false;

  bindTestButton("test-controls-hide", function () { S.testArena.controlsVisible = false; });
  bindTestButton("test-controls-tab", function () { S.testArena.controlsVisible = true; });
  var testEnemyRows = document.getElementById("test-enemy-rows");
  if (testEnemyRows && testEnemyRows.addEventListener) {
    var dragList = null, dragStartX = 0, dragStartLeft = 0, dragMoved = false;
    function endEnemyDrag() {
      if (!dragList) return;
      dragList.classList.remove("dragging");
      dragList = null;
    }
    addInputListener(testEnemyRows, "pointerdown", function (event) {
      var list = event.target && event.target.closest ? event.target.closest(".test-enemy-list") : null;
      if (!list || (event.pointerType && event.pointerType !== "mouse")) return;
      dragList = list;
      dragStartX = event.clientX;
      dragStartLeft = list.scrollLeft;
      dragMoved = false;
      list.classList.add("dragging");
    });
    addInputListener(testEnemyRows, "pointermove", function (event) {
      if (!dragList) return;
      var offset = event.clientX - dragStartX;
      if (!dragMoved && Math.abs(offset) <= 3) return;
      dragMoved = true;
      dragList.scrollLeft = dragStartLeft - offset;
      event.preventDefault();
    });
    addInputListener(testEnemyRows, "pointerup", endEnemyDrag);
    addInputListener(testEnemyRows, "pointercancel", endEnemyDrag);
    addInputListener(testEnemyRows, "pointerleave", endEnemyDrag);
    addInputListener(testEnemyRows, "click", function (event) {
      var chip = event.target, id = chip && chip.getAttribute ? chip.getAttribute("data-enemy-id") : null;
      if (dragMoved) { dragMoved = false; event.preventDefault(); event.stopPropagation(); return; }
      if (id) Game.setTestEnemy(id);
    });
  }
  bindTestButton("test-spawn-one", function () { Game.testSpawnEnemy(1); });
  bindTestButton("test-spawn-wave", function () { Game.testSpawnEnemy(C.waves[0].total); });
  bindTestButton("test-clear-enemies", Game.testClearEnemies);
  bindTestButton("test-restore", Game.testRestore);
  bindTestButton("test-skill-prev", function () { Game.selectTestSkill(-1); });
  bindTestButton("test-skill-next", function () { Game.selectTestSkill(1); });
  bindTestButton("test-unlock-skill", Game.testUnlockSkill);
  bindTestButton("test-trait-prev", function () { Game.selectTestTrait(-1); });
  bindTestButton("test-trait-next", function () { Game.selectTestTrait(1); });
  bindTestButton("test-apply-trait", Game.testApplyTrait);
  bindTestButton("test-clear-build", Game.testClearBuild);
  bindTestButton("test-rifle-toggle", Game.toggleRifle);
  bindTestButton("test-exit", Game.exitTestArena);

  var accountDialog = document.getElementById("account-dialog");
  var accountDialogTitle = document.getElementById("account-dialog-title");
  var accountDialogNote = document.getElementById("account-dialog-note");
  var accountDialogUserRow = document.getElementById("account-dialog-user-row");
  var accountDialogUser = document.getElementById("account-dialog-user");
  var accountDialogPass = document.getElementById("account-dialog-pass");
  var accountDialogError = document.getElementById("account-dialog-error");
  var accountDialogSubmit = document.getElementById("account-dialog-submit");
  var accountDialogCancel = document.getElementById("account-dialog-cancel");
  var accountDialogMode = null;

  function setDialogError(message) { if (accountDialogError) accountDialogError.textContent = message || ""; }

  function closeAccountDialog() {
    accountDialogMode = null;
    if (!accountDialog) return;
    accountDialog.hidden = true;
    if (accountDialogPass) accountDialogPass.value = "";
    setDialogError("");
  }

  Game.openAccountDialog = function (mode) {
    if (!accountDialog) return;
    var removing = mode === "delete", register = mode === "register";
    accountDialogMode = removing ? "delete" : register ? "register" : "login";
    if (accountDialogTitle) accountDialogTitle.textContent = removing ? "删除账户" : register ? "注册账户" : "登录账户";
    if (accountDialogNote) {
      accountDialogNote.textContent = removing
        ? "删除后该账户的关卡进度与资源会一并清除，且不可恢复。请输入密码确认。"
        : register ? "用户名 2–16 个中文 / 字母 / 数字 / 下划线，密码至少 6 位。" : "";
    }
    if (accountDialogUserRow) accountDialogUserRow.hidden = removing;
    if (accountDialogUser) {
      accountDialogUser.disabled = removing;
      accountDialogUser.value = removing ? Game.accounts.getUsername() : "";
    }
    if (accountDialogPass) accountDialogPass.value = "";
    setDialogError("");
    accountDialog.hidden = false;
    if (accountDialogPass) accountDialogPass.focus();
  };

  Game.syncAccountDialog = function () {
    if (!accountDialog || accountDialog.hidden) return;
    if (S.screen !== "login" && S.screen !== "account") closeAccountDialog();
  };

  function submitAccountDialog() {
    var mode = accountDialogMode || S.accountMode || "login";
    var limits = C.accounts || {};
    var username = accountDialogUser ? accountDialogUser.value.replace(/^\s+|\s+$/g, "") : "";
    var password = accountDialogPass ? accountDialogPass.value : "";
    if (mode !== "delete" && (username.length < (limits.usernameMin || 2) || username.length > (limits.usernameMax || 16))) {
      setDialogError("用户名需要 2 到 16 个字符");
      return;
    }
    if (password.length < (limits.passwordMin || 6)) {
      setDialogError("密码至少 6 位");
      return;
    }
    setDialogError("");
    if (accountDialogSubmit) accountDialogSubmit.disabled = true;
    var task = mode === "delete"
      ? Game.accounts.removeAccount(password)
      : Game.accounts[mode === "register" ? "register" : "login"](username, password);
    task.then(function (result) {
      if (accountDialogSubmit) accountDialogSubmit.disabled = false;
      if (result && result.ok) {
        closeAccountDialog();
        S.screen = mode === "delete" ? "menu" : "account";
        return;
      }
      setDialogError((result && result.error) || "操作失败");
    });
  }

  if (accountDialog) {
    if (accountDialogSubmit) addInputListener(accountDialogSubmit, "click", function (event) { event.preventDefault(); submitAccountDialog(); });
    if (accountDialogCancel) addInputListener(accountDialogCancel, "click", function (event) { event.preventDefault(); closeAccountDialog(); });
    if (accountDialogUser) addInputListener(accountDialogUser, "keydown", function (event) { if (event.key === "Enter") { event.preventDefault(); submitAccountDialog(); } });
    if (accountDialogPass) addInputListener(accountDialogPass, "keydown", function (event) { if (event.key === "Enter") { event.preventDefault(); submitAccountDialog(); } });
    addInputListener(window, "keydown", function (event) { if (event.key === "Escape" && !accountDialog.hidden) closeAccountDialog(); });
  }

  addInputListener(canvas, "pointerdown", function (event) {
    event.preventDefault();
    var point = Game.pointerPosition(event), center = C.width / 2;
    if (Game.uiMode === "react") {
      if (S.screen === "playing" || S.screen === "testArena") Game.setManualAim(point.x, point.y);
      return;
    }

    if (S.screen === "menu") {
      var menuButtons = C.menu.buttons;
      if (pointInCircle(point, C.menu.accountCircle)) Game.openAccount();
      else if (pointInRect(point, menuButtons.start)) Game.start(Game.getContinueLevel());
      else if (pointInRect(point, menuButtons.levelSelect)) Game.openLevelSelect();
      else if (pointInRect(point, menuButtons.testArena)) Game.startTestArena();
      else if (pointInRect(point, menuButtons.character)) Game.openCharacter();
      else if (pointInRect(point, menuButtons.skillCodex)) Game.openSkillCodex();
      else if (pointInRect(point, menuButtons.zombieCodex)) Game.openZombieCodex();
      return;
    }
    if (S.screen === "attributes") {
      if (pointInRect(point, C.attributesUI.back)) Game.backToCharacter();
      return;
    }
    if (S.screen === "equipment") {
      if (pointInRect(point, C.equipmentUI.bag)) { Game.openEquipmentBag(); return; }
      if (pointInRect(point, C.equipmentUI.back)) { Game.backToCharacter(); return; }
      if (Game.accounts.getStatus() === "ready") {
        for (var ei = 0; ei < C.equipment.slots.length; ei++) {
          if (pointInRect(point, Game.getEquipmentUpgradeRect(ei))) { Game.upgradeEquipment(C.equipment.slots[ei].id); return; }
        }
      }
      return;
    }
    if (S.screen === "equipmentBag") {
      if (pointInRect(point, C.equipmentBagUI.back)) { Game.backToEquipment(); return; }
      if (Game.accounts.getStatus() !== "ready" || Game.accounts.state.equipmentBagBusy) return;
      for (var bi = 0; bi < C.equipment.slots.length; bi++) {
        if (pointInRect(point, Game.getEquipmentBagTabRect(bi))) { Game.selectEquipmentBagPart(C.equipment.slots[bi].id); return; }
      }
      var bagView = Game.equipment.getBagPart(S.equipmentBagPart);
      for (bi = 0; bi < bagView.rows.length; bi++) {
        var bagRow = bagView.rows[bi];
        if (bagRow.count > 0 && !bagRow.equipped && bagRow.itemId && pointInRect(point, Game.getEquipmentBagButtonRect(bi))) {
          Game.equipEquipmentItem(bagRow.itemId);
          return;
        }
      }
      return;
    }
    if (S.screen === "wall") {
      if (pointInRect(point, C.wallUI.back)) { Game.backToCharacter(); return; }
      if (Game.accounts.getStatus() === "ready") {
        var wallView = Game.wall.getView();
        if ((wallView.canLevel || wallView.canBreakthrough) && pointInRect(point, Game.getWallActionButtonRect())) {
          Game.upgradeWall(wallView.canBreakthrough ? "breakthrough" : "level");
          return;
        }
      }
      return;
    }
    if (S.screen === "character") {
      if (S.gemSynthesisOpen) {
        if (pointInRect(point, Game.getGemSynthesisCancelRect())) { Game.closeGemSynthesis(); return; }
        if (pointInRect(point, Game.getGemSynthesisPrevRect())) { Game.setGemSynthesisPage(-1); return; }
        if (pointInRect(point, Game.getGemSynthesisNextRect())) { Game.setGemSynthesisPage(1); return; }
        if (pointInRect(point, Game.getGemSynthesisConfirmRect())) {
          if (Game.accounts.getStatus() === "ready" && !Game.accounts.state.gemBusy && Game.getGemSynthesisPlan().length) Game.synthesizeAllGems();
          return;
        }
        var plan = Game.getGemSynthesisPlan(), planPage = Game.getGemSynthesisPage(), planRows = C.gemSynthesisUI.rows;
        for (var planRow = 0; planRow < planRows; planRow++) {
          var recipe = plan[planPage * planRows + planRow];
          if (!recipe) continue;
          for (var planGem = 0; planGem < recipe.gems.length; planGem++) {
            if (pointInRect(point, Game.getGemSynthesisGemRect(planRow, planGem))) {
              Game.focusGemSynthesis(recipe.gems[planGem].id);
              return;
            }
          }
        }
        return;
      }
      if (S.characterGemDetail) {
        var detailBox = Game.getCharacterGemDetailPanel();
        if (pointInRect(point, Game.getCharacterGemDetailSocketRect())) {
          if (Game.accounts.getStatus() === "ready" && !Game.accounts.state.gemBusy && Game.getCharacterGemDetail()) Game.socketCharacterGem(S.characterGemDetail);
          return;
        }
        if (pointInRect(point, Game.getCharacterGemDetailCloseRect())) { Game.closeCharacterGemDetail(); return; }
        if (point.x < detailBox.x || point.x > detailBox.x + detailBox.w || point.y < detailBox.y || point.y > detailBox.y + detailBox.h) { Game.closeCharacterGemDetail(); return; }
        return;
      }
      if (S.characterEquipItem) {
        var equipBox = Game.getCharacterEquipDetailPanel(), equipDetail = Game.getCharacterEquipDetail();
        if (pointInRect(point, Game.getCharacterEquipReplaceRect())) {
          if (Game.accounts.getStatus() === "ready" && !Game.accounts.state.equipmentBagBusy && equipDetail && !equipDetail.equipped) Game.replaceCharacterEquipment(equipDetail.id);
          return;
        }
        if (pointInRect(point, Game.getCharacterEquipCloseRect())) { Game.closeCharacterEquip(); return; }
        if (point.x < equipBox.x || point.x > equipBox.x + equipBox.w || point.y < equipBox.y || point.y > equipBox.y + equipBox.h) { Game.closeCharacterEquip(); return; }
        return;
      }
      if (S.characterResourceDetail) {
        var resourceBox = Game.getCharacterResourceDetailPanel();
        if (pointInRect(point, Game.getCharacterResourceDetailCloseRect())) { Game.closeCharacterResource(); return; }
        if (point.x < resourceBox.x || point.x > resourceBox.x + resourceBox.w || point.y < resourceBox.y || point.y > resourceBox.y + resourceBox.h) { Game.closeCharacterResource(); return; }
        return;
      }
      if (S.characterGems) {
        var gemPanel = Game.getCharacterGemPanel(), gemPart = Game.gems.getPart(S.characterGems), gemSlot;
        var replaceGem = Game.getCharacterGemReplace();
        if (pointInRect(point, Game.getCharacterGemCloseRect())) { Game.closeCharacterGems(); return; }
        if (point.x < gemPanel.x || point.x > gemPanel.x + gemPanel.w || point.y < gemPanel.y || point.y > gemPanel.y + gemPanel.h) { Game.closeCharacterGems(); return; }
        if (Game.accounts.getStatus() === "ready" && !Game.accounts.state.gemBusy) {
          for (gemSlot = 0; gemSlot < C.gems.socketsPerPart; gemSlot++) {
            if (gemPart.sockets[gemSlot] && pointInRect(point, Game.getCharacterGemUnsocketRect(gemSlot))) {
              if (replaceGem) Game.replaceCharacterGem(replaceGem.id, gemSlot);
              else Game.unsocketGem(gemPart.sockets[gemSlot].id);
              return;
            }
          }
        }
        return;
      }
      if (pointInRect(point, Game.getCharacterHeaderRect("back"))) { Game.backToMenu(); return; }
      if (pointInRect(point, Game.getCharacterHeaderRect("attributes"))) { Game.openAttributes(); return; }
      for (var characterSlot = 0; characterSlot < C.equipment.slots.length; characterSlot++) {
        if (pointInRect(point, Game.getCharacterSlotRect(characterSlot))) {
          Game.openCharacterGems(C.equipment.slots[characterSlot].id);
          return;
        }
      }
      if (pointInRect(point, Game.getCharacterActionRect("equip"))) { Game.openEquipment(); return; }
      if (pointInRect(point, Game.getCharacterActionRect("wall"))) { Game.openWall(); return; }
      if (pointInRect(point, Game.getCharacterActionRect("skill"))) { Game.openSkillProgress(); return; }
      for (var characterTabIndex = 0; characterTabIndex < 3; characterTabIndex++) {
        if (pointInRect(point, Game.getCharacterTabRect(characterTabIndex))) {
          Game.setCharacterTab(["gem", "equipment", "resource"][characterTabIndex]);
          return;
        }
      }
      if (S.characterTab === "equipment") {
        if (pointInRect(point, Game.getCharacterEquipPagerRect("prev"))) { Game.setCharacterEquipPage(-1); return; }
        if (pointInRect(point, Game.getCharacterEquipPagerRect("next"))) { Game.setCharacterEquipPage(1); return; }
        var equipRows = Game.getCharacterEquipRows(), equipCellCount = C.characterUI.equipCells.columns * C.characterUI.equipCells.rows, equipCell;
        for (equipCell = 0; equipCell < equipCellCount; equipCell++) {
          var equipBagItem = equipRows.items[equipCell];
          if (equipBagItem && pointInRect(point, Game.getCharacterEquipCellRect(equipCell))) {
            Game.openCharacterEquip(equipBagItem.id);
            return;
          }
        }
        return;
      }
      if (S.characterTab === "resource") {
        if (pointInRect(point, Game.getCharacterResourcePagerRect("prev"))) { Game.setCharacterResourcePage(-1); return; }
        if (pointInRect(point, Game.getCharacterResourcePagerRect("next"))) { Game.setCharacterResourcePage(1); return; }
        var resources = Game.getCharacterResourceRows().items, resourceCellCount = C.characterUI.resourceCells.columns * C.characterUI.resourceCells.rows, resourceCell;
        for (resourceCell = 0; resourceCell < resourceCellCount; resourceCell++) {
          var resourceItem = resources[resourceCell];
          if (resourceItem && pointInRect(point, Game.getCharacterResourceCellRect(resourceCell))) {
            Game.openCharacterResource(resourceItem.id);
            return;
          }
        }
        return;
      }
      if (S.characterTab !== "gem") return;
      if (pointInRect(point, Game.getCharacterGemPagerRect("prev"))) { Game.setCharacterGemPage(-1); return; }
      if (pointInRect(point, Game.getCharacterGemPagerRect("next"))) { Game.setCharacterGemPage(1); return; }
      if (pointInRect(point, Game.getCharacterBagActionRect())) {
        if (Game.accounts.getStatus() === "ready" && !Game.accounts.state.gemBusy && Game.getGemSynthesisPlan().length) Game.openGemSynthesis();
        return;
      }
      if (Game.accounts.getStatus() !== "ready" || Game.accounts.state.gemBusy) return;
      var characterGems = Game.getCharacterGemRows(), gemCellCount = C.characterUI.gemCells.columns * C.characterUI.gemCells.rows, gemCell;
      for (gemCell = 0; gemCell < gemCellCount; gemCell++) {
        var lockGem = characterGems.items[gemCell];
        if (lockGem && pointInRect(point, Game.getCharacterGemLockRect(gemCell))) {
          Game.toggleGemLock(lockGem.id);
          return;
        }
      }
      for (gemCell = 0; gemCell < gemCellCount; gemCell++) {
        var socketGem = characterGems.items[gemCell];
        if (socketGem && pointInRect(point, Game.getCharacterGemCellRect(gemCell))) {
          Game.openCharacterGemDetail(socketGem.id);
          return;
        }
      }
      return;
    }
    if (S.screen === "skillProgress") {
      if (pointInRect(point, Game.getSkillProgressBackRect())) { Game.backToCharacter(); return; }
      if (pointInRect(point, Game.getSkillProgressPagerRect("prev"))) { Game.setSkillProgressPage(-1); return; }
      if (pointInRect(point, Game.getSkillProgressPagerRect("next"))) { Game.setSkillProgressPage(1); return; }
      if (Game.accounts.getStatus() === "ready" && !Game.accounts.state.skillBusy) {
        var skillRows = Game.getSkillProgressRows();
        for (var skillRow = 0; skillRow < skillRows.items.length; skillRow++) {
          var skillView = skillRows.items[skillRow];
          var skillResources = Game.accounts.getResources(), skillCost = skillView.nextCost;
          var skillAffordable = !skillCost || ((skillResources.coin || 0) >= (skillCost.coin || 0) && (skillResources[skillView.blueprintId] || 0) >= (skillCost[skillView.blueprintId] || 0));
          if (pointInRect(point, Game.getSkillProgressButtonRect(skillRow)) && skillView.level < skillView.maxLevel && skillAffordable) {
            Game.upgradeSkill(skillView.skillId);
            return;
          }
        }
      }
      return;
    }
    if (S.screen === "login") {
      var login = C.accountUI.login;
      if (pointInRect(point, login.userName) || pointInRect(point, login.password) || pointInRect(point, login.submit)) Game.openAccountDialog(S.accountMode);
      else if (pointInRect(point, login.switchMode)) Game.setAccountMode(S.accountMode === "register" ? "login" : "register");
      else if (pointInRect(point, C.accountUI.back)) Game.backToMenu();
      return;
    }
    if (S.screen === "account") {
      var accountBox = C.accountUI.account;
      if (pointInRect(point, accountBox.resourcePager.prev)) { Game.setAccountResourcePage(-1); return; }
      if (pointInRect(point, accountBox.resourcePager.next)) { Game.setAccountResourcePage(1); return; }
      if (pointInRect(point, accountBox.importButton)) Game.importLegacyProgress();
      else if (pointInRect(point, accountBox.logoutButton)) Game.logoutAccount();
      else if (pointInRect(point, accountBox.deleteButton)) Game.openAccountDialog("delete");
      else if (pointInRect(point, C.accountUI.back)) Game.backToMenu();
      return;
    }
    if (S.screen === "zombieCodex" || S.screen === "skillCodex") { handleCodexPointer(point, S.screen); return; }
    if (S.screen === "levelSelect") {
      var geo = C.levelSelect;
      if (S.levelPreview) {
        var close = Game.getLevelBriefCloseRect(), box = Game.getLevelBriefPanel();
        if (point.x >= close.x && point.x <= close.x + close.w && point.y >= close.y && point.y <= close.y + close.h) Game.closeLevelPreview();
        else if (point.x < box.x || point.x > box.x + box.w || point.y < box.y || point.y > box.y + box.h) Game.closeLevelPreview();
        return;
      }
      for (var li = 0; li < C.levels.length; li++) {
        var row = Game.getLevelRowRect(li);
        if (point.x < row.x || point.x > row.x + row.w || point.y < row.y || point.y > row.y + row.h) continue;
        var info = Game.getLevelInfoRect(li);
        if (point.x >= info.x && point.x <= info.x + info.w && point.y >= info.y && point.y <= info.y + info.h) { Game.openLevelPreview(C.levels[li].id); return; }
        Game.start(C.levels[li].id);
        return;
      }
      if (point.y >= geo.backY - 8 && point.y <= geo.backY + geo.backHeight + 8) Game.backToMenu();
      return;
    }
    if (S.screen === "upgrade") {
      var cardW = 98, gap = 8, start = (C.width - cardW * 3 - gap * 2) / 2;
      for (var i = 0; i < 3; i++) {
        var x = start + i * (cardW + gap);
        if (point.x >= x && point.x <= x + cardW && point.y >= 175 && point.y <= 430) { Game.chooseTrait(i); return; }
      }
      return;
    }
    if (S.screen === "paused") {
      if (point.x >= center - 82 && point.x <= center + 82 && point.y >= 326 && point.y <= 370) Game.resume();
      else if (point.x >= center - 82 && point.x <= center + 82 && point.y >= 382 && point.y <= 422) Game.quitLevel();
      return;
    }
    if (S.screen === "victory" || S.screen === "defeat" || S.screen === "retreat") {
      if (pointInRect(point, C.resultUI.restart)) { Game.start(S.selectedLevel); return; }
      if (pointInRect(point, C.resultUI.back)) { Game.exitToMenu(); return; }
      return;
    }
    if (S.screen === "testArena") {
      if (point.x >= 14 && point.x <= 42 && point.y >= 15 && point.y <= 43) { Game.exitTestArena(); return; }
      if (point.x >= 286 && point.x <= 354 && point.y >= 10 && point.y <= 32) { Game.toggleRifle(); return; }
      if (isInSkillSlotColumn(point)) { holdSkillSlot(point); return; }
      Game.setManualAim(point.x, point.y);
      return;
    }
    if (S.screen === "playing") {
      if (point.x >= 14 && point.x <= 42 && point.y >= 15 && point.y <= 43) { Game.pause(); return; }
      if (point.x >= 286 && point.x <= 354 && point.y >= 10 && point.y <= 32) { Game.toggleRifle(); return; }
      if (isInSkillSlotColumn(point)) { holdSkillSlot(point); return; }
      Game.setManualAim(point.x, point.y);
    }
  });
  addInputListener(canvas, "pointerup", releaseSkillSlot);
  addInputListener(canvas, "pointercancel", releaseSkillSlot);
  addInputListener(canvas, "pointerleave", releaseSkillSlot);
  addInputListener(window, "pointerup", releaseSkillSlot);
  addInputListener(window, "pointercancel", releaseSkillSlot);
  addInputListener(window, "blur", releaseSkillSlot);
  addInputListener(window, "keydown", function (event) {
    if (S.screen !== "testArena") return;
    var key = event.key.toLowerCase();
    if (key === "arrowleft") { Game.selectTestEnemy(-1); event.preventDefault(); }
    else if (key === "arrowright") { Game.selectTestEnemy(1); event.preventDefault(); }
    else if (key === "1") { Game.testSpawnEnemy(1); event.preventDefault(); }
    else if (key === "5") { Game.testSpawnEnemy(C.waves[0].total); event.preventDefault(); }
    else if (key === "c") { Game.testClearEnemies(); event.preventDefault(); }
    else if (key === "r") { Game.testRestore(); event.preventDefault(); }
    else if (key === "[") { Game.selectTestSkill(-1); event.preventDefault(); }
    else if (key === "]") { Game.selectTestSkill(1); event.preventDefault(); }
    else if (key === ",") { Game.selectTestTrait(-1); event.preventDefault(); }
    else if (key === ".") { Game.selectTestTrait(1); event.preventDefault(); }
    else if (key === "e") { Game.testUnlockSkill(); event.preventDefault(); }
    else if (key === "t") { Game.testApplyTrait(); event.preventDefault(); }
    else if (key === "x") { Game.testClearBuild(); event.preventDefault(); }
    else if (key === "h") { S.testArena.controlsVisible = !S.testArena.controlsVisible; event.preventDefault(); }
    else if (key === "escape") { Game.exitTestArena(); event.preventDefault(); }
  });
  return true;
  };

  Game.destroyInput = function () {
    inputCleanups.forEach(function (cleanup) { cleanup(); });
    inputCleanups = [];
    inputBound = false;
    canvas = null;
    if (slotHoldTimer) clearTimeout(slotHoldTimer);
    slotHoldTimer = null;
    slotHoldId = null;
    if (S.skillRangePreview) S.skillRangePreview = null;
  };

  if (Game.view && Game.view.canvas) Game.initializeInput(Game.view.canvas);
})(window.Game = window.Game || {});
