# Runtime text catalog

`ko.json` owns every user-visible Korean message and label of the runtime.
Modules call `t(key, ...values)` from `src/i18n.js`.

A string entry is a plain message. An array entry holds the literal segments
of an interpolated message; its length equals the number of values plus one.
Entries are text only: markup lives in the templates that call `t()`, so a
translation can never break the drawer's router hooks.

`tests/localization.test.mjs` checks that every `t()` call has a static key,
an existing entry and the right number of values, that no entry carries markup
and that every entry is used. Domain vocabulary that is stored in events (grade
labels, default skill costs) and transport parsing aliases stay in the engine
modules and are not translated.
