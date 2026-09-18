# Runtime message catalogs

`ko.json` owns the runtime's Korean text. Source modules refer to stable,
module-prefixed keys through `ITEMXText(key, ...values)`.

A string is a plain message. An array contains the literal segments of an
interpolated template; its length must equal the number of values plus one.
Keep HTML markup and interpolation positions intact when translating.

The concat build resolves messages once, so the SafeDOM bridge does not pay for
runtime translation lookups. `npm run build` uses Korean. Add a catalog such as
`en.json`, then run `ITEMX_LOCALE=en npm run build`; missing keys fall back to
Korean, while a missing catalog or an invalid interpolation count fails the
build. Domain replay rules and `main-protocol.txt` are not translated.
