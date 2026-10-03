/**
 * Pure recipe-unlock decision logic for the Protein ("חלבונים מהצומח") hub.
 * Loaded as a classic <script> by index.html (defines globals, same as
 * the inline block it replaced) and require()-able directly from Node
 * tests (exports the same functions via module.exports).
 *
 * Deliberate copy of italy/unlock-logic.js's shape, not a divergence -
 * every protein game (game1.html..game8.html) was already built against
 * this exact contract (see their own code comments): recipe i (0-based)
 * owns games (2i+1) and (2i+2), both writing a star count (1-3, or a flat
 * 1 for the measuring game) into protein_stars_detail[i]. Order here is
 * burger (index 0) -> arayes (1) -> sweet-potato-quinoa (2) -> falafel (3),
 * matching the order the recipes were built in and their game numbers.
 */
(function () {
  'use strict';

  var RECIPES = [
    { name:'המבורגר עדשים חומות', emoji:'🍔', color:'#8B5A2B', href:'game1.html' },
    { name:'עראיס טבעוני',         emoji:'🥙', color:'#C62839', href:'game3.html' },
    { name:'כדורי בטטה וקינואה',   emoji:'🥔', color:'#E07A28', href:'game5.html' },
    { name:'פלאפל מש ואפונה',      emoji:'🧆', color:'#7CB342', href:'game7.html' }
  ];

  function getStars() {
    return JSON.parse(localStorage.getItem('protein_stars_detail') || '[]');
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
    return getStars().slice(0, RECIPES.length).reduce(function(a, b){ return a + b; }, 0);
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
