/**
 * Pure recipe-unlock decision logic for the Italy adventure hub.
 * Loaded as a classic <script> by index.html (defines globals, same as
 * the inline block it replaced) and require()-able directly from Node
 * tests (exports the same functions via module.exports).
 */
(function () {
  'use strict';

  var RECIPES = [
    { name:'פסטה סגולה',                    emoji:'🍝', color:'#7B2D8B', href:'game1.html' },
    { name:'ברוסקטה חיפושית',              emoji:'🐞', color:'#8B4513', href:'game3.html' },
    { name:'מאפה פסטה וגבינות',            emoji:'🧀', color:'#D4872A', href:'game5.html' },
    { name:'פנקוטה וניל עם סירופ רימונים', emoji:'🍮', color:'#B5186A', href:'game7.html' },
  ];

  function getStars() {
    return JSON.parse(localStorage.getItem('italy_stars_detail') || '[]');
  }
  function recipeStars(i) {
    return getStars()[i] || 0;
  }
  function isUnlocked(i) {
    if (i === 0) return true;
    return recipeStars(i - 1) > 0;
  }
  function isDone(i) {
    return recipeStars(i) > 0;
  }
  function getTotalStars() {
    return getStars().slice(0, 4).reduce(function(a, b){ return a + b; }, 0);
  }
  function getDoneCount() {
    var n = 0;
    for (var i = 0; i < RECIPES.length; i++) if (isDone(i)) n++;
    return n;
  }

  var api = {
    RECIPES: RECIPES,
    getStars: getStars,
    recipeStars: recipeStars,
    isUnlocked: isUnlocked,
    isDone: isDone,
    getTotalStars: getTotalStars,
    getDoneCount: getDoneCount
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    window.RECIPES = RECIPES;
    window.getStars = getStars;
    window.recipeStars = recipeStars;
    window.isUnlocked = isUnlocked;
    window.isDone = isDone;
    window.getTotalStars = getTotalStars;
    window.getDoneCount = getDoneCount;
  }
})();
