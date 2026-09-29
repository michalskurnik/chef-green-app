/**
 * stem-notebook-config.js
 * Shared card catalog for "מחברת המדען" (the Scientist's Notebook) in the
 * STEM ("ניסויים במטבח") package. Defines, per station (0-indexed, same
 * order as StemUnlockLogic.STATIONS), the exact card IDs a lab game must
 * write into stem_station{s}_prediction / _result / _conclusion (s = i+1,
 * per docs/progress-keys.md's "Contract for package 4 (stem)"), and how
 * notebook.html displays them.
 *
 * This file is the single source of truth for those IDs - when game1,
 * game3, game5, game7 and game9 (the lab games) are built, they must
 * write ONLY the ids listed here for their station, so the notebook can
 * render them without per-game special-casing.
 *
 * Content matches the wording already approved on the printed recipe
 * pages (the ChatGPT-generated A4 sheets) - "שורת סיום" completion
 * sentences and the lab's own two/three-way comparisons - so a child
 * who did the real kitchen experiment recognizes the same setup here.
 *
 * Shape per station:
 *   {
 *     predictionQ:  string shown above the prediction/result cards,
 *     cards:        { id: {icon, label} } - shared by prediction & result
 *                   (same physical setups: which cup/bag/jar "wins"),
 *     correctResult: id of the card that is the real measured outcome
 *                    (used only to show a gentle "match" note - never a
 *                    pass/fail grade),
 *     conclusionQ:  the fill-in-the-blank sentence from the recipe page,
 *     conclusionCards: { id: {icon, label, correct?} } - exactly one
 *                    entry has correct:true.
 *   }
 */
(function () {
  'use strict';

  var NOTEBOOK_STATIONS = [
    // 0 - לחמניות שמרים (game1 lab / game2 sorting)
    {
      predictionQ: 'איזו כוס תעלה הכי גבוה?',
      cards: {
        a: { icon: '🥤', label: 'כוס א׳ — פושר + סוכר' },
        b: { icon: '🥤', label: 'כוס ב׳ — פושר, בלי סוכר' },
        c: { icon: '🥤', label: 'כוס ג׳ — קר + סוכר' }
      },
      correctResult: 'a',
      conclusionQ: 'השמרים אוהבים ______',
      conclusionCards: {
        sugar_warmth: { icon: '☀️', label: 'סוכר וחום פושר', correct: true },
        cold:         { icon: '🧊', label: 'קור' },
        water_only:   { icon: '💧', label: 'מים בלבד' }
      }
    },
    // 1 - ריבת תותים (game3 lab / game4 sorting)
    {
      predictionQ: 'איזו ריבה תהיה סמיכה יותר?',
      cards: {
        a: { icon: '🍓', label: 'תותים + תפוח' },
        b: { icon: '🍓', label: 'תותים בלבד' }
      },
      correctResult: 'a',
      conclusionQ: 'הריבה הסמיכה הייתה סמיכה כי ______',
      conclusionCards: {
        pectin: { icon: '🍏', label: 'יש בו פקטין מהתפוח', correct: true },
        sugar:  { icon: '🍬', label: 'יש בו הרבה סוכר' },
        time:   { icon: '⏱️', label: 'התבשל הכי הרבה זמן' }
      }
    },
    // 2 - כרוב סגול (game5 lab / game6 sorting)
    {
      predictionQ: 'מה יקרה כשמוסיפים חומץ למיץ הכרוב?',
      cards: {
        pink:   { icon: '🌸', label: 'ורוד' },
        purple: { icon: '💜', label: 'נשאר סגול' },
        blue:   { icon: '🔵', label: 'כחול-ירקרק' }
      },
      correctResult: 'pink',
      conclusionQ: 'הצבע משתנה לפי ______ של הנוזל',
      conclusionCards: {
        acidity:     { icon: '🍋', label: 'כמה הוא חומצי', correct: true },
        temperature: { icon: '🌡️', label: 'הטמפרטורה שלו' },
        sweetness:   { icon: '🍯', label: 'כמה הוא מתוק' }
      }
    },
    // 3 - גלידה בשקית (game7 lab / game8 sorting)
    {
      predictionQ: 'איזו שקית תקפא ראשונה?',
      cards: {
        with_salt:    { icon: '🧂', label: 'קרח + מלח' },
        without_salt: { icon: '🧊', label: 'קרח בלבד' }
      },
      correctResult: 'with_salt',
      conclusionQ: 'מלח גורם לקרח להיות ______',
      conclusionCards: {
        colder:  { icon: '❄️', label: 'קר יותר', correct: true },
        sweeter: { icon: '🍬', label: 'מתוק יותר' },
        softer:  { icon: '☁️', label: 'רך יותר' }
      }
    },
    // 4 - הר געש, אקסטרא (game9 lab / game10 sorting)
    {
      predictionQ: 'איזו כוס תתפרץ יותר גבוה?',
      cards: {
        a: { icon: '🌋', label: 'כוס א׳ — כפית סודה' },
        b: { icon: '🌋', label: 'כוס ב׳ — 2 כפות סודה' }
      },
      correctResult: 'b',
      conclusionQ: 'משנים רק דבר אחד כדי ______',
      conclusionCards: {
        change_one_thing: { icon: '🔍', label: 'לדעת מה גרם להבדל', correct: true },
        big_eruption:      { icon: '💥', label: 'לעשות התפרצות גדולה' },
        save_vinegar:      { icon: '🧪', label: 'לחסוך חומץ' }
      }
    }
  ];

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { NOTEBOOK_STATIONS: NOTEBOOK_STATIONS };
  } else {
    window.StemNotebookConfig = { NOTEBOOK_STATIONS: NOTEBOOK_STATIONS };
  }
})();
