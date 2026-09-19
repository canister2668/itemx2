/* ITEMX style owner. Concatenated inside the runtime closure. */
  const ITEMX_STYLE = __ITEMX_STYLE_JSON__;

  const ITEMX_CHAT_STYLE = __ITEMX_CHAT_STYLE_JSON__;

  const ITEMX_MAIN_STYLE = __ITEMX_MAIN_STYLE_JSON__;

  const ITEMX_CHIP_STYLE =
  '.itemx-event-chip{display:inline-flex;align-items:center;max-width:100%;margin:.28em .2em;padding:.28em .58em;border:1px solid rgba(126,145,174,.26);border-radius:999px;background:rgba(18,25,38,.72);color:#dce6f4;font-size:.76rem;font-weight:700;line-height:1.35;vertical-align:middle}';

  const ITEMX_CODEX_INLINE_STYLE = `.itemx2-inline-event{--ix-tone:#a58add;position:relative;isolation:isolate;display:block;max-width:720px;margin:.7rem auto 1rem;overflow:hidden;border:1px solid rgba(132,146,170,.34);border-radius:14px;background:linear-gradient(145deg,rgba(24,31,44,.98),rgba(11,15,23,.98));box-shadow:0 12px 30px rgba(0,0,0,.25),inset 0 1px rgba(255,255,255,.035);content-visibility:auto;contain:layout paint style;contain-intrinsic-size:auto 128px;color:#e9eef6;font-family:Inter,Pretendard,"Noto Sans KR",sans-serif}.itemx2-inline-event::before{content:"";position:absolute;z-index:-2;inset:-65% -12% auto 40%;height:180%;background:radial-gradient(closest-side,var(--ix-glow,rgba(165,138,221,.22)),transparent 72%);transform:rotate(-12deg)}.itemx2-inline-event::after{content:"";position:absolute;z-index:-1;inset:0;background:linear-gradient(105deg,transparent 48%,rgba(255,255,255,.025),transparent 84%)}.itemx2-inline-main{display:grid;grid-template-columns:50px minmax(0,1fr) auto;align-items:center;gap:11px;min-height:86px;padding:12px}.itemx2-inline-icon{position:relative;width:50px;height:50px;display:grid;place-items:center;overflow:hidden;border:1px solid rgba(150,165,190,.3);border-radius:12px;background:radial-gradient(circle at 35% 27%,var(--ix-glow,rgba(165,138,221,.22)),rgba(9,12,18,.86) 72%);font-size:1.45rem;box-shadow:inset 0 0 18px rgba(120,135,165,.08)}.itemx2-inline-copy{display:grid;gap:3px;min-width:0}.itemx2-inline-kicker{color:var(--ix-tone);font-size:.53rem;font-weight:900;letter-spacing:.15em}.itemx2-inline-name{overflow:hidden;color:#f1f4f9;font-size:.94rem;font-weight:900;line-height:1.3;text-overflow:ellipsis;white-space:nowrap}.itemx2-inline-meta{color:#8795aa;font-size:.61rem}.itemx2-inline-state{align-self:start;padding:4px 7px;border:1px solid rgba(150,165,190,.28);border-radius:999px;background:rgba(120,135,160,.08);color:var(--ix-tone);font-size:.53rem;font-weight:900;font-style:normal}.itemx2-inline-delta{display:flex;align-items:center;gap:5px;margin-top:3px;font-size:.58rem}.itemx2-inline-delta i{padding:3px 6px;border-radius:6px;background:rgba(255,255,255,.045);color:#8794a8;font-style:normal}.itemx2-inline-delta i:last-child{color:#f2cd80}.itemx2-inline-delta b{color:#69778d}.itemx2-inline-foot{display:flex;align-items:flex-start;gap:7px;padding:9px 12px;border-top:1px solid rgba(255,255,255,.055);background:rgba(4,7,12,.24);color:#95a1b3;font-size:.64rem;line-height:1.45}.itemx2-inline-foot b{flex:0 0 auto;color:var(--ix-tone);font-size:.57rem}.itemx2-inline-skill-theme-fire{--ix-tone:#f0ad66;--ix-glow:rgba(226,92,43,.26)}.itemx2-inline-skill-theme-ice{--ix-tone:#91dff1;--ix-glow:rgba(82,184,218,.22)}.itemx2-inline-skill-theme-lightning{--ix-tone:#f0d878;--ix-glow:rgba(131,151,255,.24)}.itemx2-inline-skill-theme-dark{--ix-tone:#b697e8;--ix-glow:rgba(91,44,141,.3)}.itemx2-inline-skill-theme-light{--ix-tone:#ead9a8;--ix-glow:rgba(235,216,161,.2)}.itemx2-inline-skill-theme-arcane{--ix-tone:#b59bea;--ix-glow:rgba(128,91,207,.24)}.itemx2-inline-skill .itemx2-inline-icon::before{content:"";position:absolute;width:31px;height:31px;border-radius:44% 56% 62% 38%;background:radial-gradient(circle at 65% 30%,rgba(255,255,255,.48),var(--ix-glow) 32%,transparent 68%);animation:itemx2-inline-drift 7s ease-in-out infinite alternate}.itemx2-inline-icon>span{position:relative;z-index:1}.itemx2-inline-encounter{--ix-tone:#df8588;--ix-glow:rgba(199,69,76,.22)}.itemx2-inline-encounter .itemx2-inline-icon{background:radial-gradient(circle at 50% 24%,rgba(133,82,100,.82),rgba(58,39,55,.9) 48%,#11141b 78%);text-shadow:0 5px 12px #000}.itemx2-inline-warning{position:absolute;z-index:-1;right:-8%;bottom:16px;width:62%;height:1px;background:linear-gradient(90deg,transparent,rgba(255,102,102,.7),transparent);box-shadow:0 0 7px rgba(255,80,80,.5);animation:itemx2-inline-scan 4.4s ease-in-out infinite}.itemx2-inline-ended{--ix-tone:#a6aeb9;--ix-glow:rgba(150,160,173,.13)}.itemx2-inline-ended .itemx2-inline-icon{filter:grayscale(1) saturate(.2) brightness(.72)}.itemx2-inline-ended .itemx2-inline-warning{display:none}.itemx2-inline-ended::before{animation:none}.itemx2-inline-event.motion-off::before,.itemx2-inline-event.motion-off::after,.itemx2-inline-event.motion-off .itemx2-inline-icon::before,.itemx2-inline-event.motion-off .itemx2-inline-warning{display:none!important;animation:none!important}@keyframes itemx2-inline-drift{from{transform:translate(-3px,2px) rotate(-8deg);opacity:.62}to{transform:translate(4px,-3px) rotate(11deg);opacity:1}}@keyframes itemx2-inline-scan{0%,100%{transform:translateY(-13px);opacity:.12}45%,55%{opacity:.72}50%{transform:translateY(13px)}}@media(prefers-reduced-motion:reduce){.itemx2-inline-event::before,.itemx2-inline-event::after,.itemx2-inline-icon::before,.itemx2-inline-warning{animation:none!important}}@media(max-width:520px){.itemx2-inline-event{margin:.62rem 0 .9rem}.itemx2-inline-main{grid-template-columns:46px minmax(0,1fr) auto;gap:9px;padding:10px}.itemx2-inline-icon{width:46px;height:46px}.itemx2-inline-name{font-size:.86rem}.itemx2-inline-foot{font-size:.6rem}}`;

  const ITEMX_CODEX_INLINE_DENSE_STYLE = `.itemx2-inline-event.itemx2-inline-event{align-self:start;box-sizing:border-box;width:min(400px,calc(100% - 8px));max-width:400px;margin:.42rem auto .65rem;border-radius:11px;line-height:1.2}.itemx2-inline-event .itemx2-inline-main{grid-template-columns:36px minmax(0,1fr) auto;align-items:center;gap:8px;min-height:54px;height:auto;padding:6px 8px 5px}.itemx2-inline-event .itemx2-inline-icon{align-self:center;width:36px;height:36px;min-width:36px;min-height:36px;border-radius:9px;font-size:1.08rem;line-height:1}.itemx2-inline-event .itemx2-inline-copy{align-self:center;gap:1px;line-height:1.15}.itemx2-inline-event .itemx2-inline-kicker{font-size:.46rem;line-height:1.2;letter-spacing:.12em}.itemx2-inline-event .itemx2-inline-name{font-size:.82rem;line-height:1.18}.itemx2-inline-event .itemx2-inline-meta{font-size:.51rem;line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.itemx2-inline-event .itemx2-inline-quick{display:flex;align-items:center;gap:3px;min-width:0;margin-top:2px;overflow:hidden}.itemx2-inline-event .itemx2-inline-quick i{flex:0 1 auto;min-width:0;height:auto;padding:1px 4px;border:1px solid rgba(150,165,190,.16);border-radius:4px;background:rgba(255,255,255,.035);color:#9ca9bb;font-size:.47rem;font-style:normal;line-height:1.35;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.itemx2-inline-event .itemx2-inline-quick i b{color:var(--ix-tone);font-weight:900}.itemx2-inline-event .itemx2-inline-foot{align-items:center;min-height:23px;height:auto;padding:4px 8px;font-size:.53rem;line-height:1.3}.itemx2-inline-event .itemx2-inline-foot b{font-size:.49rem}.itemx2-inline-event .itemx2-inline-foot span{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.itemx2-inline-event .itemx2-inline-state{display:inline-flex;align-self:center;align-items:center;justify-content:center;width:auto;height:auto;min-height:0;padding:2px 5px;font-size:.46rem;line-height:1.2;white-space:nowrap}@media(max-width:520px){.itemx2-inline-event.itemx2-inline-event{margin:.36rem auto .58rem}.itemx2-inline-event .itemx2-inline-main{grid-template-columns:34px minmax(0,1fr) auto;gap:6px;min-height:51px;padding:5px 7px 4px}.itemx2-inline-event .itemx2-inline-icon{width:34px;height:34px;min-width:34px;min-height:34px}.itemx2-inline-event .itemx2-inline-name{font-size:.78rem}.itemx2-inline-event .itemx2-inline-quick{gap:2px}.itemx2-inline-event .itemx2-inline-quick i{padding:1px 3px;font-size:.44rem}.itemx2-inline-event .itemx2-inline-quick i:nth-last-child(n+5){display:none}.itemx2-inline-event .itemx2-inline-foot{min-height:21px;padding:3px 7px;font-size:.5rem}}`;

  const ITEMX_CODEX_INLINE_APPRAISAL_STYLE = `
.itemx2-inline-event.itemx2-inline-appraisal{--ix-fg:#e8e0d2;--ix-dim:#9f9586;--ix-line:#544936;--ix-surface:rgba(93,76,48,.18);border:1px solid var(--ix-line);border-radius:3px;background:repeating-linear-gradient(102deg,rgba(255,235,190,.024) 0 2px,transparent 2px 7px),repeating-linear-gradient(11deg,rgba(0,0,0,.13) 0 3px,transparent 3px 9px),radial-gradient(115% 92% at 50% -16%,#292218,#11100e 72%);color:var(--ix-fg);font-family:"Nanum Myeongjo","Noto Serif KR",Georgia,serif;box-shadow:inset 0 0 36px rgba(0,0,0,.54),0 7px 18px rgba(0,0,0,.22),0 0 14px color-mix(in srgb,var(--rk,#a58add) 18%,transparent)}
.itemx2-inline-event.itemx2-inline-appraisal::before{inset:0 0 auto;z-index:5;width:auto;height:2px;background:linear-gradient(90deg,transparent,var(--rk,#a58add) 18%,var(--rk,#a58add) 82%,transparent);opacity:.82;transform:none}
.itemx2-inline-event.itemx2-inline-appraisal::after{z-index:-1;background:radial-gradient(72% 125% at 8% 20%,var(--ix-glow),transparent 68%),linear-gradient(105deg,transparent 54%,rgba(255,255,255,.025),transparent 86%)}
.itemx2-inline-appraisal .itemx2-inline-main{position:relative;grid-template-columns:42px minmax(0,1fr) auto;gap:8px;min-height:58px;padding:8px 9px 6px}
.itemx2-inline-appraisal .itemx2-inline-main::before{content:"";position:absolute;right:-12%;bottom:-58%;width:66%;height:145%;border-radius:50%;background:radial-gradient(closest-side,var(--ix-glow),transparent 73%);opacity:.7;pointer-events:none}
.itemx2-inline-appraisal .itemx2-inline-icon{width:42px;height:42px;min-width:42px;min-height:42px;border:1px solid color-mix(in srgb,var(--rk,#a58add) 58%,#4c4437);border-radius:50%;background:radial-gradient(circle at 35% 28%,color-mix(in srgb,var(--rk,#a58add) 26%,transparent),rgba(12,11,10,.94) 70%);font-size:1.2rem;box-shadow:inset 0 0 0 2px rgba(9,8,7,.55),inset 0 0 15px var(--ix-glow),0 0 10px color-mix(in srgb,var(--rk,#a58add) 18%,transparent)}
.itemx2-inline-appraisal .itemx2-inline-copy{position:relative;z-index:1;display:grid;grid-template-columns:minmax(0,1fr) auto;gap:1px 6px}
.itemx2-inline-appraisal .itemx2-inline-kicker{grid-column:1/-1;color:color-mix(in srgb,var(--rk,#a58add) 76%,#dccba8);font-size:.43rem;letter-spacing:.18em}
.itemx2-inline-appraisal .itemx2-inline-name{grid-column:1;align-self:end;color:#f2eadc;font-size:.84rem;text-shadow:0 1px 2px #000,0 0 7px var(--ix-glow)}
.itemx2-inline-appraisal .itemx2-inline-tier{grid-column:2;align-self:end;color:var(--rk,#c7ae79);font-size:.52rem;font-weight:800;white-space:nowrap}
.itemx2-inline-appraisal .itemx2-inline-meta{grid-column:1/-1;color:var(--ix-dim);font-size:.49rem}
.itemx2-inline-appraisal .itemx2-inline-state{position:relative;z-index:1;align-self:start;margin-top:1px;border:1px solid color-mix(in srgb,var(--rk,#a58add) 44%,#4e4639);border-radius:2px;background:rgba(18,15,11,.6);color:color-mix(in srgb,var(--rk,#a58add) 78%,#efe2c8);font-size:.44rem;letter-spacing:.04em}
.itemx2-inline-appraisal .itemx2-inline-rule{height:1px;margin:0 9px;background:linear-gradient(90deg,transparent,var(--ix-line) 12%,color-mix(in srgb,var(--rk,#a58add) 34%,var(--ix-line)) 50%,var(--ix-line) 88%,transparent)}
.itemx2-inline-appraisal .itemx2-inline-quick{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:3px;margin:5px 8px 6px;overflow:visible}
.itemx2-inline-appraisal .itemx2-inline-quick i{display:grid;gap:1px;min-width:0;padding:3px 4px;border:1px solid color-mix(in srgb,var(--ix-line) 72%,transparent);border-radius:2px;background:var(--ix-surface);color:#d8d0c3;font-size:.48rem;line-height:1.15;white-space:normal}
.itemx2-inline-appraisal .itemx2-inline-quick i b{overflow:hidden;color:var(--ix-dim);font-size:.39rem;letter-spacing:.08em;text-overflow:ellipsis;white-space:nowrap}
.itemx2-inline-appraisal .itemx2-inline-quick i span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.itemx2-inline-appraisal .itemx2-inline-foot{min-height:25px;padding:4px 8px;border-top:1px solid rgba(180,158,116,.13);background:rgba(5,5,4,.26);color:#bcb2a2;font-size:.51rem}
.itemx2-inline-appraisal .itemx2-inline-foot b{color:color-mix(in srgb,var(--rk,#a58add) 72%,#ddc99e);font-size:.43rem;letter-spacing:.08em}
.itemx2-inline-appraisal.itemx2-inline-encounter{--ix-line:#51413f;--ix-surface:rgba(95,53,52,.16);background:repeating-linear-gradient(101deg,rgba(237,199,190,.018) 0 2px,transparent 2px 8px),radial-gradient(105% 85% at 84% 0,rgba(121,48,53,.16),transparent 64%),linear-gradient(151deg,#1c1715,#0e0e0e 68%)}
.itemx2-inline-appraisal.itemx2-inline-ended{--ix-line:#41454b;--ix-surface:rgba(92,98,108,.12);filter:none;background:repeating-linear-gradient(101deg,rgba(220,225,232,.014) 0 2px,transparent 2px 8px),linear-gradient(151deg,#18191a,#0d0e10 70%)}
.itemx2-inline-appraisal.itemx2-inline-ended::after{filter:grayscale(1);opacity:.46}
.itemx2-inline-appraisal.motion-off::before{display:block!important;animation:none!important}
@media(max-width:520px){.itemx2-inline-appraisal .itemx2-inline-main{grid-template-columns:38px minmax(0,1fr) auto;min-height:54px;padding:7px 7px 5px}.itemx2-inline-appraisal .itemx2-inline-icon{width:38px;height:38px;min-width:38px;min-height:38px}.itemx2-inline-appraisal .itemx2-inline-quick{grid-template-columns:repeat(2,minmax(0,1fr));margin:4px 7px 5px}.itemx2-inline-appraisal .itemx2-inline-quick i{padding:3px}.itemx2-inline-appraisal .itemx2-inline-quick i:nth-last-child(n+5){display:grid}.itemx2-inline-appraisal .itemx2-inline-foot{padding:4px 7px}}

/* v5 inline pass: carry the card's rarity frame, serif weight and encounter states
   into the body cards without growing them, so chat keeps one visual language. */
.itemx2-inline-event.itemx2-inline-appraisal{box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--rk,#a58add) 34%,transparent),inset 0 0 36px rgba(0,0,0,.54),0 7px 18px rgba(0,0,0,.24),0 0 16px color-mix(in srgb,var(--rk,#a58add) 20%,transparent)}
.itemx2-inline-appraisal .itemx2-inline-name{font-size:1rem;font-weight:700;letter-spacing:-.005em}
.itemx2-inline-appraisal .itemx2-inline-kicker{color:color-mix(in srgb,var(--rk,#a58add) 62%,#9f9586)}
/* Active encounter: a threat ring on the portrait and a scan sweep across the card. */
.itemx2-inline-encounter:not(.itemx2-inline-ended) .itemx2-inline-icon{position:relative;overflow:visible}
.itemx2-inline-encounter:not(.itemx2-inline-ended) .itemx2-inline-icon::after{content:"";position:absolute;inset:-5px;border-radius:50%;border:1px solid color-mix(in srgb,var(--rk,#d64b60) 66%,transparent);opacity:0;animation:itemx2-inline-threat 2.6s ease-out infinite}
@keyframes itemx2-inline-threat{0%{opacity:.85;transform:scale(.88)}70%{opacity:0;transform:scale(1.16)}100%{opacity:0}}
/* Resolved encounter: the record seal replaces the live state. */
.itemx2-inline-ended .itemx2-inline-state{position:relative;rotate:-7deg;border-radius:4px;border-width:1.5px;letter-spacing:.2em;font-family:"Nanum Myeongjo","Noto Serif KR",serif}
.itemx2-inline-encounter.motion-off .itemx2-inline-icon::after,.itemx2-inline-encounter.motion-lite .itemx2-inline-icon::after{animation:none!important;opacity:0}
@media(prefers-reduced-motion:reduce){.itemx2-inline-encounter .itemx2-inline-icon::after{animation:none!important;opacity:0}}

.itemx2-inline-stat-changed{border-color:color-mix(in srgb,var(--rk,#a58add) 46%,transparent)}
.itemx2-inline-stat-changed>s{color:var(--ix-dim,#9f9586);text-decoration:none;opacity:.72;font-size:.92em}
.itemx2-inline-stat-changed>u{margin:0 3px;color:var(--ix-dim,#9f9586);text-decoration:none;font-size:.85em}
.itemx2-inline-stat-changed>em{color:color-mix(in srgb,var(--rk,#a58add) 74%,var(--ix-fg,#e8e0d2));font-style:normal;font-weight:800}

/* v6 body cards: the item card's frame language at inline scale. Chips carry every
   change, so the card keeps its old height while saying more. */
.itemx2-inline-event.itemx2-inline-appraisal{border-radius:13px;box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--rk,#a58add) 40%,transparent),inset 0 0 30px rgba(0,0,0,.5),0 6px 18px rgba(0,0,0,.26),0 0 16px color-mix(in srgb,var(--rk,#a58add) 18%,transparent)}
.itemx2-inline-appraisal .itemx2-inline-main{grid-template-columns:46px minmax(0,1fr) auto;gap:11px;align-items:start;padding:12px 13px 10px;min-height:0}
.itemx2-inline-appraisal .itemx2-inline-icon{align-self:start;width:46px;height:46px;min-width:46px;min-height:46px;border-radius:12px;font-size:1.3rem}
.itemx2-inline-appraisal .itemx2-inline-name{display:block;margin:2px 0 3px;font-size:1.02rem;font-weight:700;letter-spacing:-.005em;white-space:normal;overflow:visible;text-overflow:clip;overflow-wrap:anywhere;line-height:1.32}
.itemx2-inline-appraisal .itemx2-inline-kicker{color:color-mix(in srgb,var(--rk,#a58add) 64%,#9f9586)}
.itemx2-inline-appraisal .itemx2-inline-meta{display:block;font-size:.63rem;line-height:1.6;color:var(--ix-dim,#9f9586);white-space:normal;overflow:visible;text-overflow:clip;overflow-wrap:anywhere}
.itemx2-inline-appraisal .itemx2-inline-state{align-self:start;margin-top:2px}
/* Compact chips replace the fixed four-cell grid. */
.itemx2-inline-appraisal .itemx2-inline-quick{display:flex;flex-wrap:wrap;gap:5px;margin-top:8px;grid-template-columns:none}
.itemx2-inline-appraisal .itemx2-inline-quick>i{display:inline-flex;align-items:baseline;gap:4px;padding:2.5px 7px;border:1px solid var(--ix-line,#544936);border-radius:6px;background:rgba(255,255,255,.04);font-size:.6rem;font-weight:700;color:var(--ix-fg,#e8e0d2);font-style:normal}
.itemx2-inline-appraisal .itemx2-inline-quick>i>b{color:var(--ix-dim,#9f9586);font-size:.55rem;font-weight:800;letter-spacing:.06em}
.itemx2-inline-appraisal .itemx2-inline-quick>i>span{color:var(--ix-fg,#e8e0d2)}
.itemx2-inline-appraisal .itemx2-inline-stat-changed{border-color:color-mix(in srgb,var(--rk,#a58add) 52%,transparent)}
.itemx2-inline-appraisal .itemx2-inline-stat-changed>s{color:var(--ix-dim,#9f9586);text-decoration:none;opacity:.8}
.itemx2-inline-appraisal .itemx2-inline-stat-changed>u{color:var(--ix-dim,#9f9586);text-decoration:none;margin:0 1px}
.itemx2-inline-appraisal .itemx2-inline-stat-changed>em{font-style:normal;font-weight:800;color:color-mix(in srgb,var(--rk,#a58add) 76%,var(--ix-fg,#e8e0d2))}
.itemx2-inline-appraisal .itemx2-inline-foot{display:flex;align-items:flex-start;flex-wrap:wrap;gap:4px 9px;padding:9px 13px 10px;border-top:1px solid var(--ix-line,#544936);background:rgba(8,7,6,.42);font-size:.66rem;line-height:1.7}
.itemx2-inline-appraisal .itemx2-inline-foot>b{flex:0 0 auto;color:color-mix(in srgb,var(--rk,#a58add) 70%,#9f9586);font-size:.56rem;font-weight:900;letter-spacing:.1em}
.itemx2-inline-appraisal .itemx2-inline-foot>span{flex:1 1 200px;min-width:0;overflow:visible;text-overflow:clip;white-space:normal;overflow-wrap:anywhere}.itemx2-inline-appraisal .itemx2-inline-foot>b{padding-top:1px}
.itemx2-inline-more{flex:0 0 auto;font-style:normal;font-size:.6rem;font-weight:800;color:color-mix(in srgb,var(--rk,#a58add) 72%,var(--ix-fg,#e8e0d2));opacity:.85}
/* Affinity body layer, one per card. */
.itemx2-inline-body{position:absolute;inset:0;pointer-events:none;z-index:0}
.itemx2-inline-body-fire{inset:auto -4% -14% -4%;height:72%;mix-blend-mode:screen;filter:blur(11px);background:radial-gradient(38% 90% at 22% 100%,color-mix(in srgb,var(--rk,#ff7a3d) 42%,transparent),transparent 72%),radial-gradient(42% 96% at 72% 100%,color-mix(in srgb,var(--rk,#ff7a3d) 34%,transparent),transparent 74%);animation:itemx2-inline-fire 3.4s ease-in-out infinite alternate}
@keyframes itemx2-inline-fire{from{opacity:.42}to{opacity:.92}}
.itemx2-inline-body-bolt{mix-blend-mode:screen;background:radial-gradient(ellipse at 66% 16%,color-mix(in srgb,var(--rk,#f5d13c) 38%,transparent),transparent 58%);opacity:0;animation:itemx2-inline-bolt 3.6s step-end infinite}
@keyframes itemx2-inline-bolt{0%,78%,85%,100%{opacity:0}79%,81%{opacity:1}80%,82.5%{opacity:.25}}
.itemx2-inline-body-dark{mix-blend-mode:multiply;background:radial-gradient(120% 96% at 50% 50%,transparent 36%,rgba(8,5,16,.5) 78%,rgba(4,2,10,.8));animation:itemx2-inline-dark 7s ease-in-out infinite alternate}
@keyframes itemx2-inline-dark{from{opacity:.4}to{opacity:.9}}
.itemx2-inline-body-haze{mix-blend-mode:screen;filter:blur(12px);background:linear-gradient(108deg,transparent 28%,color-mix(in srgb,var(--rk,#a58add) 26%,transparent) 47%,transparent 66%);animation:itemx2-inline-haze 7s ease-in-out infinite alternate}
@keyframes itemx2-inline-haze{from{opacity:.35;transform:translateX(-6%)}to{opacity:.85;transform:translateX(6%)}}
/* Encounter states. */
.itemx2-inline-scan{position:absolute;left:0;right:0;top:0;height:1.5px;pointer-events:none;z-index:1;background:linear-gradient(90deg,transparent,color-mix(in srgb,var(--rk,#d64b60) 85%,#fff 8%),transparent);box-shadow:0 0 10px color-mix(in srgb,var(--rk,#d64b60) 55%,transparent);animation:itemx2-inline-scan 3.6s ease-in-out infinite}
@keyframes itemx2-inline-scan{0%,100%{transform:translateY(4px);opacity:.14}50%{transform:translateY(84px);opacity:.9}}
.itemx2-inline-seal{position:absolute;right:12px;top:50%;z-index:3;padding:3px 8px;background:rgba(10,9,8,.62);border:1.5px solid color-mix(in srgb,var(--rk,#6c7686) 55%,transparent);border-radius:5px;font-family:"Nanum Myeongjo","Noto Serif KR",serif;font-size:.62rem;font-weight:900;letter-spacing:.22em;color:color-mix(in srgb,var(--rk,#6c7686) 72%,#9f9586);opacity:.8;transform:translateY(-50%) rotate(-8deg)}
.itemx2-inline-ended .itemx2-inline-state{display:none}.itemx2-inline-ended .itemx2-inline-copy{padding-right:64px}
.itemx2-inline-ended .itemx2-inline-body{display:none}
.motion-off .itemx2-inline-body,.motion-off .itemx2-inline-scan,.itemx2-inline-event.motion-off .itemx2-inline-icon::after{animation:none!important}
@media(prefers-reduced-motion:reduce){.itemx2-inline-body,.itemx2-inline-scan{animation:none!important}}
`;

  const ITEMX_PRESENTATION_STYLE = __ITEMX_PRESENTATION_STYLE_JSON__;

  const ITEMX_BADGE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="176" viewBox="0 0 48 176" role="img" aria-label="ITEMX CODEX"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#1b2940"/><stop offset="1" stop-color="#090d17"/></linearGradient><filter id="s" x="-40%" y="-20%" width="180%" height="140%"><feDropShadow dx="0" dy="5" stdDeviation="5" flood-opacity=".52"/></filter></defs><g filter="url(#s)"><rect x="1" y="1" width="46" height="174" rx="10" fill="url(#g)" stroke="#536684" stroke-width="1.2"/><path d="M2 35h44M2 141h44" stroke="#263650" stroke-width="1"/></g><text x="24" y="26" text-anchor="middle" font-size="17">📦</text><text x="24" y="88" text-anchor="middle" dominant-baseline="middle" transform="rotate(90 24 88)" fill="#f1f5fc" font-family="Arial,sans-serif" font-size="10.5" font-weight="900" letter-spacing="2">CODEX</text><path d="M17 154h14M24 147v14" fill="none" stroke="#9abcf4" stroke-width="2.4" stroke-linecap="round"/></svg>`;

  const ITEMX_BADGE_ICON = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(ITEMX_BADGE_SVG)}`;

  const BADGE_POSITIONS = [
    ['lb', ITEMXText("style.011")],
    ['lm', ITEMXText("style.010")],
    ['lt', ITEMXText("style.009")],
    ['rb', ITEMXText("style.008")],
    ['rm', ITEMXText("style.007")],
    ['rt', ITEMXText("style.006")]
  ];

  function badgeStyle() {
    const positions = {
      lb: 'left:4px!important;right:auto!important;top:auto!important;bottom:calc(5.2rem + env(safe-area-inset-bottom,0px))!important;transform:none!important;border-radius:0 8px 8px 0!important',
      lm: 'left:4px!important;right:auto!important;top:50%!important;bottom:auto!important;transform:translateY(-50%)!important;border-radius:0 8px 8px 0!important',
      lt: 'left:4px!important;right:auto!important;top:calc(4.5rem + env(safe-area-inset-top,0px))!important;bottom:auto!important;transform:none!important;border-radius:0 8px 8px 0!important',
      rb: 'right:4px!important;left:auto!important;top:auto!important;bottom:calc(5.2rem + env(safe-area-inset-bottom,0px))!important;transform:none!important;border-radius:8px 0 0 8px!important',
      rm: 'right:4px!important;left:auto!important;top:50%!important;bottom:auto!important;transform:translateY(-50%)!important;border-radius:8px 0 0 8px!important',
      rt: 'right:4px!important;left:auto!important;top:calc(4.5rem + env(safe-area-inset-top,0px))!important;bottom:auto!important;transform:none!important;border-radius:8px 0 0 8px!important'
    };
    const button =
      'button[aria-label="ITEMX CODEX"],button[aria-label="ITEMX"],button:has(img[src*="ITEMX%20CODEX"]),button:has(img[src*="ITEMX%20inventory"])';
    const states =
      'button[aria-label="ITEMX CODEX"]:hover,button[aria-label="ITEMX CODEX"]:active,button[aria-label="ITEMX CODEX"]:focus,button[aria-label="ITEMX"]:hover,button[aria-label="ITEMX"]:active,button[aria-label="ITEMX"]:focus,button:has(img[src*="ITEMX%20CODEX"]):hover,button:has(img[src*="ITEMX%20CODEX"]):active,button:has(img[src*="ITEMX%20CODEX"]):focus,button:has(img[src*="ITEMX%20inventory"]):hover,button:has(img[src*="ITEMX%20inventory"]):active,button:has(img[src*="ITEMX%20inventory"]):focus';
    const wrappers =
      'button[aria-label="ITEMX CODEX"]>div,button[aria-label="ITEMX"]>div,button:has(img[src*="ITEMX%20CODEX"])>div,button:has(img[src*="ITEMX%20inventory"])>div';
    const images =
      'button[aria-label="ITEMX CODEX"] img,button[aria-label="ITEMX"] img,button:has(img[src*="ITEMX%20CODEX"]) img[src*="ITEMX%20CODEX"],button:has(img[src*="ITEMX%20inventory"]) img[src*="ITEMX%20inventory"]';
    return `${button}{${positions[uiState.badgePosition] || positions.rm};display:flex!important;align-items:center!important;justify-content:center!important;box-sizing:border-box!important;width:48px!important;height:176px!important;min-width:48px!important;min-height:176px!important;padding:0!important;overflow:visible!important;border:0!important;outline:0!important;background:none!important;background-color:transparent!important;box-shadow:none!important;cursor:pointer!important;touch-action:manipulation!important;z-index:50!important}${states}{background:none!important;background-color:transparent!important;box-shadow:none!important}${wrappers}{display:block!important;box-sizing:border-box!important;width:48px!important;height:176px!important;min-width:48px!important;min-height:176px!important;padding:0!important;overflow:visible!important;border:0!important;border-radius:0!important;background:none!important;box-shadow:none!important}${images}{display:block!important;box-sizing:border-box!important;width:48px!important;height:176px!important;min-width:48px!important;min-height:176px!important;max-width:48px!important;max-height:176px!important;border-radius:0!important;object-fit:contain!important}`;
  }

  const codexPageStyle = () => `
.itemx-codex-page-active{display:grid!important}
.itemx2-codex-detail-index{display:none!important}
.itemx2-codex-card{position:relative;display:block;min-height:70px;border:1px solid #263247;border-radius:12px;background:linear-gradient(145deg,#121a28,#0b111b);overflow:hidden}.itemx2-codex-summary{position:relative;z-index:1;display:grid;grid-template-columns:48px minmax(0,1fr) minmax(72px,auto);gap:10px;align-items:center;min-height:70px;padding:10px;cursor:pointer}.itemx2-codex-glyph{display:grid;place-items:center;width:48px;height:48px;border:1px solid #40506b;border-radius:11px;background:#0b111c;color:#dbe8ff;font-size:1.2rem}.itemx2-codex-copy{display:grid;gap:3px;min-width:0}.itemx2-codex-copy strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#edf2fb;font-size:.82rem}.itemx2-codex-copy small{color:#8494ad;font-size:.66rem}.itemx2-codex-tags{display:flex;flex-wrap:wrap;gap:4px}.itemx2-codex-tags i{padding:2px 5px;border:1px solid #344259;border-radius:999px;color:#aebbd0;font-size:.58rem;font-style:normal}.itemx2-skill-meta{display:grid;grid-template-columns:auto auto;gap:2px 5px;align-items:center;padding:6px 7px;border:1px solid #2e3a50;border-radius:9px;background:rgba(9,14,23,.82);font-size:.58rem}.itemx2-skill-meta small{color:#6f809a}.itemx2-skill-meta b{color:#dce6f5;font-size:.62rem;text-align:right}.itemx2-mastery{grid-column:2/-1;display:grid;grid-template-columns:repeat(5,1fr);gap:4px}.itemx2-mastery i{height:5px;border-radius:6px;background:#202a3a}.itemx2-mastery i.on{background:linear-gradient(90deg,#66b8ff,#a985ff);box-shadow:0 0 8px rgba(102,184,255,.35)}.itemx2-bestiary-card.active{border-color:#70404a;box-shadow:inset 3px 0 #b55b68}.itemx2-bestiary-card img{width:48px;height:48px;border-radius:11px;object-fit:cover}
.itemx-codex-list{display:grid;gap:9px}.itemx-codex-list-button{width:100%;padding:0;border:0;color:inherit;text-align:left;font:inherit}.itemx2-codex-summary::after{content:'›';position:absolute;right:9px;bottom:5px;color:#71839f;font-size:.85rem;font-weight:900}.itemx-codex-page{position:relative;display:grid;gap:11px;min-height:100%;padding:2px 0 14px;animation:itemx-codex-page-in .22s cubic-bezier(.2,.78,.2,1) both}.itemx2-codex-page{display:none}.itemx2-codex-entry-choice:checked~.itemx2-codex-summary{display:none}.itemx2-codex-entry-choice:checked~.itemx2-codex-page{display:grid}.itemx2-root-skills:has(.itemx2-codex-entry-choice:checked)>.itemx2-codex-note,.itemx2-root-bestiary:has(.itemx2-codex-entry-choice:checked)>.itemx2-codex-note{display:none}.itemx2-root-skills:has(.itemx2-codex-entry-choice:checked)>.itemx2-codex-entry:not(:has(.itemx2-codex-entry-choice:checked)),.itemx2-root-bestiary:has(.itemx2-codex-entry-choice:checked)>.itemx2-codex-entry:not(:has(.itemx2-codex-entry-choice:checked)){display:none}.itemx-codex-back{justify-self:start;display:inline-flex;align-items:center;min-height:34px;padding:0 10px;border:1px solid #2d3a50;border-radius:9px;background:#101824;color:#c8d4e7;cursor:pointer;font:inherit;font-size:.7rem;font-weight:800}.itemx-codex-hero{position:relative;isolation:isolate;display:grid;place-items:center;min-height:218px;padding:24px 18px 20px;overflow:hidden;border:1px solid #33435d;border-radius:17px;background:radial-gradient(circle at 50% 45%,rgba(91,150,255,.19),transparent 31%),linear-gradient(145deg,#121b2b,#080d16 70%);box-shadow:inset 0 0 45px rgba(63,116,205,.1),0 12px 34px rgba(0,0,0,.32)}.itemx-codex-hero::before,.itemx-codex-hero::after{content:'';position:absolute;left:50%;top:44%;z-index:-1;border-radius:50%;transform:translate(-50%,-50%);pointer-events:none}.itemx-codex-hero::before{width:158px;height:158px;border:1px solid rgba(113,181,255,.34);background:repeating-conic-gradient(from 0deg,rgba(128,195,255,.28) 0 2deg,transparent 2deg 28deg);mask:radial-gradient(circle,transparent 53%,#000 54% 58%,transparent 59%);animation:itemx-codex-orbit 8s linear infinite}.itemx-codex-hero::after{width:112px;height:112px;border:1px solid rgba(173,139,255,.32);box-shadow:0 0 42px rgba(76,142,255,.2),inset 0 0 26px rgba(151,105,255,.12);animation:itemx-codex-orbit-reverse 5.5s linear infinite}.itemx-codex-hero-glyph{position:relative;z-index:2;display:grid;place-items:center;width:82px;height:82px;border:1px solid rgba(177,210,255,.55);border-radius:24px;background:radial-gradient(circle at 45% 38%,#263e62,#101827 68%);box-shadow:0 0 25px rgba(94,164,255,.28),inset 0 0 22px rgba(132,184,255,.16);color:#eff7ff;font-size:2.6rem;text-shadow:0 0 14px rgba(142,202,255,.8)}.itemx-codex-hero-copy{position:relative;z-index:2;display:grid;gap:5px;margin-top:18px;text-align:center}.itemx-codex-hero-copy small{color:#8fa4c4;font-size:.65rem;font-weight:800;letter-spacing:.16em;text-transform:uppercase}.itemx-codex-hero-copy strong{color:#f3f7ff;font-size:1.08rem}.itemx-codex-hero-copy span{color:#9eb0ca;font-size:.68rem}.itemx-codex-stat-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.itemx-codex-stat{display:grid;gap:4px;min-height:60px;padding:10px;border:1px solid #26344a;border-radius:11px;background:linear-gradient(145deg,#111a28,#0b111b)}.itemx-codex-stat small{color:#70819b;font-size:.59rem;font-weight:800}.itemx-codex-stat strong{color:#e8effa;font-size:.72rem;overflow-wrap:anywhere}.itemx-codex-section{display:grid;gap:7px;padding:12px;border:1px solid #243147;border-radius:12px;background:#0c131e;color:#becadd;font-size:.7rem;line-height:1.58}.itemx-codex-section h4{margin:0;color:#d9e6f8;font-size:.67rem;letter-spacing:.08em}.itemx-codex-section p{margin:0;white-space:pre-wrap}.itemx-codex-chip-row{display:flex;flex-wrap:wrap;gap:5px}.itemx-codex-chip-row i{padding:4px 7px;border:1px solid #34445e;border-radius:999px;background:#111a28;color:#b8c7dd;font-size:.61rem;font-style:normal}.itemx-codex-mastery{display:grid;grid-template-columns:repeat(10,1fr);gap:4px}.itemx-codex-mastery i{height:7px;border-radius:999px;background:#202b3c}.itemx-codex-mastery i.on{background:linear-gradient(90deg,#5cbcff,#a978ff);box-shadow:0 0 9px rgba(92,188,255,.42)}.itemx-monster-hero{border-color:#623743;background:radial-gradient(circle at 50% 40%,rgba(222,62,88,.2),transparent 34%),repeating-linear-gradient(0deg,transparent 0 22px,rgba(179,63,79,.035) 23px),linear-gradient(145deg,#211018,#090d14 72%);box-shadow:inset 0 0 54px rgba(190,39,64,.12),0 12px 34px rgba(0,0,0,.38)}.itemx-monster-hero::before{width:174px;height:174px;border-color:rgba(255,99,123,.36);background:repeating-conic-gradient(from 0deg,rgba(255,86,112,.32) 0 1.5deg,transparent 1.5deg 22deg);animation-duration:11s}.itemx-monster-hero::after{left:50%;top:18%;width:100%;height:2px;border:0;border-radius:0;background:linear-gradient(90deg,transparent,#ff667e,transparent);box-shadow:0 0 18px rgba(255,62,92,.7);transform:translate3d(-50%,0,0);will-change:transform,opacity;animation:itemx-codex-scan 3.2s ease-in-out infinite}.itemx-monster-portrait{position:relative;z-index:2;width:112px;height:112px;border:1px solid rgba(255,124,143,.58);border-radius:18px;object-fit:cover;box-shadow:0 0 0 5px rgba(93,24,35,.35),0 0 32px rgba(255,65,94,.3);filter:saturate(.86) contrast(1.06)}.itemx-monster-hero .itemx-codex-hero-glyph{border-color:rgba(255,124,143,.54);background:radial-gradient(circle at 45% 38%,#5a2632,#1b1018 70%);box-shadow:0 0 28px rgba(255,60,91,.3),inset 0 0 22px rgba(255,111,131,.12)}.itemx-threat-banner{position:absolute;left:10px;top:10px;z-index:3;padding:5px 8px;border:1px solid rgba(255,109,130,.48);border-radius:999px;background:rgba(41,10,17,.82);color:#ff9aab;font-size:.58rem;font-weight:900;letter-spacing:.12em}@keyframes itemx-codex-page-in{from{opacity:0;transform:translate3d(12px,0,0)}to{opacity:1;transform:none}}@keyframes itemx-codex-orbit{to{transform:translate(-50%,-50%) rotate(360deg)}}@keyframes itemx-codex-orbit-reverse{to{transform:translate(-50%,-50%) rotate(-360deg)}}@keyframes itemx-codex-scan{0%,100%{opacity:.2;transform:translate3d(-50%,0,0)}50%{opacity:1;transform:translate3d(-50%,132px,0)}}.itemx2-effects-off .itemx-fx,.itemx2-effects-off .itemx-cond,.itemx2-effects-off .itemx-codex-hero::before,.itemx2-effects-off .itemx-codex-hero::after,.itemx2-effects-off .itemx2-skill-card::after{display:none!important;animation:none!important}@media(prefers-reduced-motion:reduce){.itemx-codex-page,.itemx-codex-hero::before,.itemx-codex-hero::after{animation:none!important}}
.itemx2-font-small{--itemx-ui-scale:1}.itemx2-font-medium{--itemx-ui-scale:1.12}.itemx2-font-large{--itemx-ui-scale:1.25}.itemx2-font-small,.itemx2-font-medium,.itemx2-font-large{--itemx-text-xs:calc(.62rem * var(--itemx-ui-scale));--itemx-text-sm:calc(.70rem * var(--itemx-ui-scale));--itemx-text-md:calc(.82rem * var(--itemx-ui-scale));--itemx-text-lg:calc(1.08rem * var(--itemx-ui-scale))}.itemx2-codex-copy strong{font-size:var(--itemx-text-md,.82rem)}.itemx-codex-hero-copy strong{font-size:var(--itemx-text-lg,1.08rem)}.itemx-codex-section{font-size:var(--itemx-text-sm,.7rem)}
.itemx2-codex-fx{position:absolute;pointer-events:none;contain:paint;--fx:#78b9ff;--fx2:#a77fff;--fx3:#eef7ff;--fx-speed:8s}.itemx2-codex-list-fx{z-index:0;inset:0;overflow:hidden;opacity:.82;animation:none}.itemx2-codex-hero-fx{z-index:0;inset:0;overflow:hidden}.itemx2-codex-hero-fx i,.itemx2-codex-hero-fx b,.itemx2-codex-hero-fx em{position:absolute;display:block;font-style:normal;pointer-events:none}.itemx-skill-hero::before,.itemx-skill-hero::after{display:none!important}
.itemx2-skill-theme-fire{--fx:#ff7a3d;--fx2:#ffd067}.itemx2-skill-theme-ice{--fx:#72d8f4;--fx2:#a7b9ff}.itemx2-skill-theme-lightning{--fx:#9fc6ff;--fx2:#f2e773}.itemx2-skill-theme-dark{--fx:#9169df;--fx2:#d166df}.itemx2-skill-theme-light{--fx:#f7e6b2;--fx2:#fff}.itemx2-skill-theme-arcane{--fx:#789cff;--fx2:#b07be9}
.itemx2-skill-list-fx{opacity:.44;background:radial-gradient(ellipse at 91% 52%,color-mix(in srgb,var(--fx) 24%,transparent),transparent 39%)}.itemx2-skill-theme-fire.itemx2-skill-list-fx{background:radial-gradient(ellipse at 92% 78%,rgba(255,84,31,.3),transparent 39%),linear-gradient(158deg,transparent 68%,rgba(255,192,75,.16))}.itemx2-skill-theme-ice.itemx2-skill-list-fx{background:linear-gradient(128deg,transparent 69%,rgba(188,242,255,.2) 70% 78%,transparent 79%),radial-gradient(ellipse at 92% 45%,rgba(74,175,223,.17),transparent 38%)}.itemx2-skill-theme-lightning.itemx2-skill-list-fx{background:linear-gradient(117deg,transparent 70%,rgba(242,235,99,.42) 71% 72%,transparent 73% 77%,rgba(125,183,255,.3) 78% 79%,transparent 80%)}.itemx2-skill-theme-dark.itemx2-skill-list-fx{background:radial-gradient(ellipse at 90% 52%,rgba(6,3,14,.8),transparent 42%),radial-gradient(ellipse at 96% 46%,rgba(134,65,180,.24),transparent 33%)}.itemx2-skill-theme-light.itemx2-skill-list-fx{background:radial-gradient(ellipse at 91% 49%,rgba(255,246,214,.28),transparent 40%),linear-gradient(112deg,transparent 73%,rgba(245,216,143,.15))}.itemx2-skill-theme-arcane.itemx2-skill-list-fx{background:radial-gradient(ellipse at 91% 51%,rgba(78,117,211,.22),transparent 39%),radial-gradient(circle at 84% 34%,rgba(189,145,239,.55) 0 1px,transparent 2px),radial-gradient(circle at 95% 70%,rgba(117,189,242,.48) 0 1px,transparent 2px)}
.itemx2-skill-rank-normal.itemx2-skill-list-fx{opacity:.2}.itemx2-skill-rank-magic.itemx2-skill-list-fx{opacity:.34}.itemx2-skill-rank-rare.itemx2-skill-list-fx{opacity:.48}.itemx2-skill-rank-unique.itemx2-skill-list-fx{opacity:.62}.itemx2-skill-rank-epic.itemx2-skill-list-fx{opacity:.72}.itemx2-skill-rank-legendary.itemx2-skill-list-fx,.itemx2-skill-rank-mythical.itemx2-skill-list-fx,.itemx2-skill-rank-empyrean.itemx2-skill-list-fx{opacity:.86}
.itemx-skill-hero{border-color:color-mix(in srgb,var(--rk) 45%,#33435d);background:radial-gradient(ellipse at 50% 46%,color-mix(in srgb,var(--p) 15%,transparent),transparent 38%),linear-gradient(145deg,#141a28,#080c14 74%);box-shadow:inset 0 0 48px color-mix(in srgb,var(--pg) 26%,transparent),0 12px 34px rgba(0,0,0,.38)}.itemx-skill-hero .itemx2-skill-weapon-fx{z-index:0}.itemx-skill-hero .itemx-codex-hero-glyph{width:92px;height:92px;border-color:color-mix(in srgb,var(--rk) 62%,#58667d);border-radius:26px;background:radial-gradient(circle at 43% 36%,color-mix(in srgb,var(--p) 32%,#26364e),#0b111c 70%);box-shadow:0 0 0 4px color-mix(in srgb,var(--rk) 10%,transparent),0 0 34px color-mix(in srgb,var(--pg) 62%,transparent),inset 0 0 24px color-mix(in srgb,var(--p) 18%,transparent);text-shadow:0 0 17px color-mix(in srgb,var(--p) 80%,transparent)}.itemx-skill-hero.itemx2-skill-rank-normal .itemx-fx{opacity:.3}.itemx-skill-hero.itemx2-skill-rank-magic .itemx-fx{opacity:.48}.itemx-skill-hero.itemx2-skill-rank-rare .itemx-fx{opacity:.66}.itemx-skill-hero.itemx2-skill-rank-unique .itemx-fx{opacity:.82}.itemx-skill-hero.itemx2-skill-rank-epic .itemx-fx,.itemx-skill-hero.itemx2-skill-rank-legendary .itemx-fx,.itemx-skill-hero.itemx2-skill-rank-mythical .itemx-fx,.itemx-skill-hero.itemx2-skill-rank-empyrean .itemx-fx{opacity:1}.itemx-skill-hero.itemx2-skill-rank-legendary,.itemx-skill-hero.itemx2-skill-rank-mythical,.itemx-skill-hero.itemx2-skill-rank-empyrean{box-shadow:inset 0 0 58px color-mix(in srgb,var(--pg) 40%,transparent),0 15px 40px rgba(0,0,0,.42),0 0 22px color-mix(in srgb,var(--rk) 18%,transparent)}.itemx2-skill-type-passive .itemx-fx{opacity:.72}.itemx2-skill-type-sealed .itemx-fx,.itemx2-skill-status-sealed .itemx-fx{opacity:.3;filter:saturate(.42) brightness(.68)}.itemx2-skill-status-equipped .itemx-codex-hero-glyph{box-shadow:0 0 0 4px color-mix(in srgb,var(--rk) 16%,transparent),0 0 42px color-mix(in srgb,var(--pg) 78%,transparent),inset 0 0 24px color-mix(in srgb,var(--p) 22%,transparent)}.itemx2-skill-status-lost .itemx-fx{opacity:.12;filter:grayscale(.86) brightness(.5)}.itemx2-skill-status-lost .itemx-fx *{animation:none!important}
.itemx-monster-hero{border-color:#623743;background:radial-gradient(circle at 50% 40%,rgba(222,62,88,.2),transparent 34%),repeating-linear-gradient(0deg,transparent 0 22px,rgba(179,63,79,.035) 23px),linear-gradient(145deg,#211018,#090d14 72%);box-shadow:inset 0 0 54px rgba(190,39,64,.12),0 12px 34px rgba(0,0,0,.38)}.itemx-monster-hero::before{width:174px;height:174px;border-color:rgba(255,99,123,.36);background:repeating-conic-gradient(from 0deg,rgba(255,86,112,.32) 0 1.5deg,transparent 1.5deg 22deg);animation-duration:11s}.itemx-monster-hero::after{left:50%;top:18%;width:100%;height:2px;border:0;border-radius:0;background:linear-gradient(90deg,transparent,#ff667e,transparent);box-shadow:0 0 18px rgba(255,62,92,.7);transform:translate3d(-50%,0,0);animation:itemx-codex-scan 3.2s ease-in-out infinite}.itemx-monster-portrait{filter:saturate(.86) contrast(1.06)}.itemx-monster-hero .itemx-codex-hero-glyph{border-color:rgba(255,124,143,.54);background:radial-gradient(circle at 45% 38%,#5a2632,#1b1018 70%);box-shadow:0 0 28px rgba(255,60,91,.3),inset 0 0 22px rgba(255,111,131,.12)}
.itemx2-encounter-hero-fx{--fx:#bf687a;--fx2:#73849f;--fx-duration:6s}.itemx2-encounter-hero-fx i{inset:12% 18%;border:1px solid color-mix(in srgb,var(--fx) 48%,transparent);border-radius:50%;box-shadow:0 0 30px color-mix(in srgb,var(--fx) 25%,transparent);animation:itemx2-codex-spin var(--fx-duration) linear infinite}.itemx2-encounter-hero-fx b{inset:27% 8%;background:repeating-conic-gradient(from 20deg,color-mix(in srgb,var(--fx2) 32%,transparent) 0 2deg,transparent 2deg 31deg);mask:radial-gradient(circle,transparent 54%,#000 56% 58%,transparent 60%);animation:itemx2-codex-spin calc(var(--fx-duration) * 1.45) linear infinite reverse}.itemx2-encounter-hero-fx em{left:8%;right:8%;bottom:5%;height:34%;background:radial-gradient(ellipse at 50% 100%,color-mix(in srgb,var(--fx) 28%,transparent),transparent 68%);filter:blur(8px);animation:itemx2-codex-breathe calc(var(--fx-duration) * .75) ease-in-out infinite}
.itemx2-encounter-theme-beast{--fx:#e7aa61;--fx2:#d85d4d}.itemx2-encounter-theme-undead{--fx:#8ed9c2;--fx2:#7c62a8}.itemx2-encounter-theme-construct{--fx:#75b9d6;--fx2:#b3ccd4}.itemx2-encounter-theme-dragon{--fx:#ff674b;--fx2:#efb74e}.itemx2-encounter-theme-aquatic{--fx:#49c9dc;--fx2:#557fe9}.itemx2-encounter-theme-insect{--fx:#9bc15e;--fx2:#d8b85a}.itemx2-encounter-theme-humanoid,.itemx2-encounter-theme-unknown{--fx:#bf687a;--fx2:#73849f}.itemx2-encounter-list-fx{opacity:.82;animation:itemx2-codex-breathe 6s ease-in-out infinite}.itemx2-encounter-theme-beast.itemx2-encounter-list-fx{background:linear-gradient(115deg,transparent 68%,color-mix(in srgb,var(--fx) 20%,transparent)),repeating-linear-gradient(70deg,transparent 0 13px,color-mix(in srgb,var(--fx2) 14%,transparent) 14px 15px)}.itemx2-encounter-theme-undead.itemx2-encounter-list-fx,.itemx2-encounter-theme-aquatic.itemx2-encounter-list-fx{background:radial-gradient(ellipse at 85% 80%,color-mix(in srgb,var(--fx) 30%,transparent),transparent 48%)}.itemx2-encounter-theme-construct.itemx2-encounter-list-fx{background:repeating-linear-gradient(90deg,transparent 0 20px,color-mix(in srgb,var(--fx) 11%,transparent) 21px),repeating-linear-gradient(0deg,transparent 0 15px,color-mix(in srgb,var(--fx2) 8%,transparent) 16px)}.itemx2-encounter-theme-dragon.itemx2-encounter-list-fx{background:radial-gradient(circle at 90% 50%,color-mix(in srgb,var(--fx) 32%,transparent),transparent 38%)}.itemx2-encounter-theme-insect.itemx2-encounter-list-fx{background:radial-gradient(circle at 82% 32%,color-mix(in srgb,var(--fx) 30%,transparent) 0 2px,transparent 3px),radial-gradient(circle at 94% 61%,color-mix(in srgb,var(--fx2) 26%,transparent) 0 2px,transparent 3px)}.itemx2-threat-1.itemx2-encounter-list-fx{opacity:.88}.itemx2-threat-2.itemx2-encounter-list-fx,.itemx2-threat-2 .itemx2-encounter-hero-fx{filter:brightness(1.12)}.itemx2-threat-3.itemx2-encounter-list-fx,.itemx2-threat-3 .itemx2-encounter-hero-fx{filter:brightness(1.28) saturate(1.18)}.itemx2-encounter-warning .itemx2-encounter-hero-fx::after{content:'';position:absolute;left:0;right:0;top:12%;height:2px;background:linear-gradient(90deg,transparent,#ff637c,transparent);box-shadow:0 0 16px #ff3d60;animation:itemx2-codex-warning 3s ease-in-out infinite}.itemx2-encounter-sparring{--fx:#6eb8ee;--fx2:#d4b96a}.itemx-monster-hero.itemx2-encounter-ended{border-color:#3f4652;background:radial-gradient(circle at 50% 40%,rgba(118,126,139,.14),transparent 34%),repeating-linear-gradient(0deg,transparent 0 22px,rgba(130,138,150,.025) 23px),linear-gradient(145deg,#171b22,#090d13 72%);box-shadow:inset 0 0 54px rgba(105,115,130,.09),0 12px 34px rgba(0,0,0,.38)}.itemx2-encounter-ended.itemx2-encounter-list-fx,.itemx2-encounter-ended .itemx2-encounter-hero-fx{opacity:.34;filter:grayscale(.65)}.itemx2-encounter-ended .itemx-monster-portrait{opacity:.72;filter:grayscale(.82) saturate(.28) contrast(1.04)}.itemx2-encounter-ended .itemx-codex-hero-copy{opacity:.72}.itemx2-encounter-ended,.itemx2-encounter-ended *{animation-play-state:paused!important}@keyframes itemx2-codex-spin{to{transform:rotate(360deg)}}@keyframes itemx2-codex-breathe{0%,100%{opacity:.42}50%{opacity:1}}@keyframes itemx2-codex-warning{0%,100%{opacity:.15;transform:translateY(0)}50%{opacity:.9;transform:translateY(130px)}}
.itemx-monster-hero.itemx2-encounter-ended::before{border-color:rgba(139,147,160,.22);background:repeating-conic-gradient(from 0deg,rgba(151,159,171,.18) 0 1.5deg,transparent 1.5deg 22deg);animation-play-state:paused!important}.itemx-monster-hero.itemx2-encounter-ended::after,.itemx2-encounter-ended .itemx2-encounter-hero-fx::after{background:linear-gradient(90deg,transparent,#8b94a3,transparent);box-shadow:0 0 14px rgba(125,135,150,.42);animation-play-state:paused!important}
.itemx2-encounter-outcome{position:relative;overflow:hidden;border-color:#453b31;background:radial-gradient(ellipse at 92% 14%,rgba(205,157,76,.11),transparent 42%),linear-gradient(145deg,#151711,#0d1118 72%)}.itemx2-encounter-outcome::after{content:'';position:absolute;right:-18px;bottom:-24px;width:98px;height:72px;border-radius:55% 45% 48% 52%;background:radial-gradient(ellipse,rgba(180,119,57,.13),transparent 68%);pointer-events:none}.itemx2-encounter-outcome-head{position:relative;z-index:1;display:flex;align-items:center;justify-content:space-between;gap:8px}.itemx2-encounter-outcome-head h4{color:#e8c98d}.itemx2-encounter-outcome-head i{padding:3px 7px;border:1px solid rgba(205,166,98,.28);border-radius:999px;background:rgba(55,43,23,.45);color:#d9bb82;font-size:.58rem;font-style:normal}.itemx2-encounter-outcome p{position:relative;z-index:1;color:#d3d8df}
@keyframes itemx2-fire-breathe{from{opacity:.52;transform:translate3d(-2px,5px,0) scale(.96,1)}to{opacity:.88;transform:translate3d(3px,-4px,0) scale(1.04,1.06)}}@keyframes itemx2-fire-embers{from{opacity:.2;transform:translate3d(0,12px,0)}45%{opacity:.8}to{opacity:.08;transform:translate3d(5px,-20px,0)}}@keyframes itemx2-ice-float{from{opacity:.42;transform:translate3d(-3px,3px,0) rotate(-1.2deg)}to{opacity:.68;transform:translate3d(3px,-3px,0) rotate(1.4deg)}}@keyframes itemx2-lightning-quiet{0%,15%,19%,71%,75%,100%{opacity:.45}16%,18%,72%,74%{opacity:.9}}@keyframes itemx2-lightning-strike{0%,12%,17%,63%,68%,100%{opacity:.08}13%,16%,64%,67%{opacity:.84}}@keyframes itemx2-dark-draw{from{opacity:.35;transform:translate3d(-3px,1px,0) scale(1.04)}to{opacity:.66;transform:translate3d(4px,-2px,0) scale(.94)}}@keyframes itemx2-light-drift{from{opacity:.3;transform:translate3d(-2px,2px,0) scale(.98)}to{opacity:.64;transform:translate3d(3px,-2px,0) scale(1.03)}}@keyframes itemx2-arcane-parallax{from{opacity:.38;transform:translate3d(-3px,2px,0)}to{opacity:.68;transform:translate3d(4px,-3px,0)}}@keyframes itemx2-undead-haze{from{opacity:.32;transform:translate3d(-5px,2px,0)}to{opacity:.58;transform:translate3d(6px,-2px,0)}}@keyframes itemx2-construct-scan{0%,100%{opacity:.18;transform:translateY(-20px)}50%{opacity:.78;transform:translateY(116px)}}@keyframes itemx2-aquatic-caustic{from{opacity:.34;transform:translate3d(-3px,2px,0)}to{opacity:.6;transform:translate3d(4px,-3px,0)}}@keyframes itemx2-insect-drift{from{opacity:.35;transform:translate3d(-3px,2px,0)}to{opacity:.57;transform:translate3d(4px,-2px,0)}}@keyframes itemx2-combat-warning{0%,100%{opacity:.12;transform:translateY(0)}50%{opacity:.78;transform:translateY(132px)}}
.itemx2-effects-off .itemx2-codex-fx{display:none!important;animation:none!important}.itemx2-effects-off .itemx2-codex-fx *{animation:none!important}@media(prefers-reduced-motion:reduce){.itemx2-codex-fx,.itemx2-codex-fx *,.itemx2-skill-weapon-fx,.itemx2-skill-weapon-fx *{animation:none!important}}
`;

  const ITEMX_SETTINGS_STYLE = `.itemx2-root-empty{padding:2rem;text-align:center;color:#77839c}.itemx2-root-settings{flex:1;min-height:0;overflow-x:hidden;overflow-y:auto;overscroll-behavior:contain;touch-action:pan-y;-webkit-overflow-scrolling:touch;padding:16px 16px calc(16px + env(safe-area-inset-bottom,0px))}.itemx2-position-choice,.itemx2-font-choice{display:grid;place-items:center;min-height:38px;border:1px solid #2b3547;border-radius:9px;background:#151d2a;color:#9aabc4;cursor:pointer}.itemx2-font-choice.itemx2-font-on{border-color:#d4af6e;background:#292316;color:#f3dcaa}.itemx2-position-on{border-color:#d4af6e;background:#292316;color:#f3dcaa}.itemx2-root-setting-card{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:13px;border:1px solid #1c2331;border-radius:12px;background:#0d121c}.itemx2-root-setting-card span{display:grid;gap:3px}.itemx2-root-setting-card small{color:#77839c;line-height:1.4}.itemx2-root-setting-button{min-height:36px;padding:0 11px;border:1px solid #2b3547;border-radius:9px;background:#151d2a;color:#cbd7e9;cursor:pointer}.itemx2-status-row{display:flex!important;flex-direction:row!important;flex-wrap:wrap;gap:5px!important;margin-top:3px}.itemx2-status-chip{display:inline-flex!important;padding:3px 7px;border:1px solid #354157;border-radius:999px;background:#131a26;color:#93a2ba;font-size:.66rem;font-weight:800;font-style:normal}.itemx2-status-chip-warn{border-color:#6a5530;color:#e8c987;background:#241d10}.itemx2-root-setting-button-primary{border-color:#6e5a32;background:#2a2316;color:#f0d79d}.itemx2-setting-on{border-color:#4e8968!important;background:#12241a!important;color:#a9e6c2!important}.itemx2-setting-cleanup{border-color:#65333a!important;background:#241216!important;color:#ffadb5!important}.itemx2-root-setting-button:disabled,.itemx2-root-setting-button-busy{opacity:.58;cursor:default;pointer-events:none}.itemx2-manager-fold{border:1px solid #283247;border-radius:12px;background:#0b1019;overflow:hidden}.itemx2-manager-fold summary{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:13px;cursor:pointer;color:#f0d79d;font-weight:800;list-style:none}.itemx2-manager-fold summary::-webkit-details-marker{display:none}.itemx2-manager-fold summary::after{content:'＋';color:#8291aa}.itemx2-manager-fold[open] summary::after{content:'－'}.itemx2-manager-body{display:grid;gap:10px;padding:0 12px 12px}.itemx2-manager-label{display:grid;gap:5px;color:#8592a8;font-size:.72rem}.itemx2-manager-editor{min-height:58px;padding:9px;border:1px solid #293448;border-radius:9px;background:#121925;color:#e3e9f3;white-space:pre-wrap;overflow-wrap:anywhere;outline:none}.itemx2-manager-editor:focus{border-color:#637ba3}.itemx2-manager-list{display:grid;gap:7px}.itemx2-manager-actions{display:flex;gap:5px}.itemx2-manager-actions button{min-height:31px;padding:0 8px;border:1px solid #344159;border-radius:7px;background:#172131;color:#cbd7e9;cursor:pointer}.itemx2-manager-actions .itemx2-manager-remove{border-color:#65333a;color:#ffadb5}.itemx2-manager-create{display:grid;gap:7px;padding-top:3px;border-top:1px solid #1d2737}.itemx2-domain-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:7px}.itemx2-domain-card{display:grid;gap:5px;padding:10px;border:1px solid #273247;border-radius:10px;background:#101722;color:#dce5f2;text-align:left}.itemx2-domain-card small{color:#718199;font-size:.62rem}.itemx2-debug-fold{border-color:#334056}.itemx2-debug-body{display:grid;gap:8px;padding:0 12px 12px}.itemx2-debug-grid{display:grid;grid-template-columns:72px minmax(0,1fr);gap:5px 8px;font-size:.64rem}.itemx2-debug-grid b{color:#718199}.itemx2-debug-grid span{color:#c4cfdf;overflow-wrap:anywhere}.itemx2-debug-log{display:grid;gap:4px;max-height:180px;overflow:auto;padding:8px;border:1px solid #202b3d;border-radius:8px;background:#080d15;color:#91a2ba;font:10px/1.45 monospace;white-space:pre-wrap;overflow-wrap:anywhere}`;

  const rootDrawerStyle = () => `
.itemx2-search-controls{display:flex;gap:6px;padding:8px 10px;border-bottom:1px solid #354157}.itemx2-search-query{flex:1;min-width:0;min-height:28px;padding:5px 7px;border:1px solid #536684;border-radius:6px;font-size:.75rem;overflow-wrap:anywhere}.itemx2-search-query:empty:before{content:attr(data-placeholder);opacity:.6}.itemx2-search-controls button{flex:none;border:1px solid #536684;border-radius:6px;padding:4px 8px;background:transparent;color:inherit;font-size:.7rem}

.itemx2-root-drawer,.itemx2-root-drawer *{box-sizing:border-box}
.itemx2-root-drawer{--itemx-ui-scale:1;--itemx-text-xs:calc(.62rem * var(--itemx-ui-scale));--itemx-text-sm:calc(.70rem * var(--itemx-ui-scale));--itemx-text-md:calc(.82rem * var(--itemx-ui-scale));--itemx-text-lg:calc(1.08rem * var(--itemx-ui-scale));position:fixed;inset:0;z-index:49;pointer-events:none;font-family:Inter,Pretendard,"Noto Sans KR",sans-serif;color:#e6ebf4}.itemx2-root-drawer.itemx2-font-medium{--itemx-ui-scale:1.12}.itemx2-root-drawer.itemx2-font-large{--itemx-ui-scale:1.25}
.itemx2-root-control{position:fixed!important;width:1px!important;height:1px!important;opacity:0!important;pointer-events:none!important}
.itemx2-native-badge{position:fixed;z-index:50;display:block;width:48px;height:176px;padding:0;overflow:visible;pointer-events:auto;cursor:pointer;touch-action:manipulation;background:transparent;border:0;box-shadow:none}
.itemx2-native-badge img{display:block;width:48px;height:176px;max-width:none;border:0;border-radius:0;pointer-events:none}
.itemx2-update-indicator{position:absolute;right:-2px;top:5px;z-index:2;display:grid;place-items:center;width:17px;height:17px;border:1px solid rgba(174,255,204,.8);border-radius:999px;background:#16834b;box-shadow:0 0 0 2px rgba(7,12,19,.88),0 3px 10px rgba(25,196,105,.38);color:#effff5;font-size:11px;font-weight:950;line-height:1;pointer-events:none}
.itemx2-update-label{display:inline-flex;margin-left:6px;padding:2px 5px;border:1px solid rgba(112,225,155,.46);border-radius:999px;background:rgba(20,107,61,.34);color:#94e9b3;font-size:8px;font-weight:950;letter-spacing:.08em;vertical-align:1px}
.itemx2-aux-status{position:fixed;z-index:52;display:none;align-items:center;gap:7px;min-height:34px;padding:0 11px;border:1px solid rgba(212,175,110,.48);border-radius:999px;background:rgba(9,13,23,.94);box-shadow:0 8px 24px rgba(0,0,0,.48),0 0 14px rgba(212,175,110,.14);color:#f0dfb9;font-size:11px;font-weight:800;white-space:nowrap;pointer-events:none}.itemx2-aux-status-on{display:flex}.itemx2-aux-status i{width:12px;height:12px;border:2px solid rgba(240,223,185,.24);border-top-color:#f0c979;border-radius:50%;animation:itemx2-aux-spin .8s linear infinite}
.itemx2-root-drawer.itemx2-pos-lb .itemx2-aux-status{left:58px;right:auto;top:auto;bottom:calc(5.2rem + 70px + env(safe-area-inset-bottom,0px));transform:none}.itemx2-root-drawer.itemx2-pos-lm .itemx2-aux-status{left:58px;right:auto;top:50%;bottom:auto;transform:translateY(-50%)}.itemx2-root-drawer.itemx2-pos-lt .itemx2-aux-status{left:58px;right:auto;top:calc(4.5rem + 70px + env(safe-area-inset-top,0px));bottom:auto;transform:none}
.itemx2-root-drawer.itemx2-pos-rb .itemx2-aux-status{right:58px;left:auto;top:auto;bottom:calc(5.2rem + 70px + env(safe-area-inset-bottom,0px));transform:none}.itemx2-root-drawer.itemx2-pos-rm .itemx2-aux-status{right:58px;left:auto;top:50%;bottom:auto;transform:translateY(-50%)}.itemx2-root-drawer.itemx2-pos-rt .itemx2-aux-status{right:58px;left:auto;top:calc(4.5rem + 70px + env(safe-area-inset-top,0px));bottom:auto;transform:none}
.itemx2-root-drawer.itemx2-pos-lb .itemx2-native-badge{left:4px;right:auto;top:auto;bottom:calc(5.2rem + env(safe-area-inset-bottom,0px));transform:none}.itemx2-root-drawer.itemx2-pos-lm .itemx2-native-badge{left:4px;right:auto;top:50%;bottom:auto;transform:translateY(-50%)}.itemx2-root-drawer.itemx2-pos-lt .itemx2-native-badge{left:4px;right:auto;top:calc(4.5rem + env(safe-area-inset-top,0px));bottom:auto;transform:none}
.itemx2-root-drawer.itemx2-pos-rb .itemx2-native-badge{right:4px;left:auto;top:auto;bottom:calc(5.2rem + env(safe-area-inset-bottom,0px));transform:none}.itemx2-root-drawer.itemx2-pos-rm .itemx2-native-badge{right:4px;left:auto;top:50%;bottom:auto;transform:translateY(-50%)}.itemx2-root-drawer.itemx2-pos-rt .itemx2-native-badge{right:4px;left:auto;top:calc(4.5rem + env(safe-area-inset-top,0px));bottom:auto;transform:none}
.itemx2-root-drawer.itemx2-pos-lb .itemx2-root-panel{left:60px;right:auto;top:auto;bottom:12px;transform:none}.itemx2-root-drawer.itemx2-pos-lm .itemx2-root-panel{left:60px;right:auto;top:50%;bottom:auto;transform:translateY(-50%)}.itemx2-root-drawer.itemx2-pos-lt .itemx2-root-panel{left:60px;right:auto;top:12px;bottom:auto;transform:none}
.itemx2-root-drawer.itemx2-pos-rb .itemx2-root-panel{right:60px;left:auto;top:auto;bottom:12px;transform:none}.itemx2-root-drawer.itemx2-pos-rm .itemx2-root-panel{right:60px;left:auto;top:50%;bottom:auto;transform:translateY(-50%)}.itemx2-root-drawer.itemx2-pos-rt .itemx2-root-panel{right:60px;left:auto;top:12px;bottom:auto;transform:none}
.itemx2-root-drawer.itemx2-is-open .itemx2-native-badge{display:none}
.itemx2-root-drawer.itemx2-host-settings .itemx2-native-badge,.itemx2-root-drawer.itemx2-host-settings .itemx2-aux-status,.itemx2-root-drawer.itemx2-host-settings .itemx2-root-layer,.itemx2-root-drawer.itemx2-host-settings .itemx2-boot-card{display:none!important}
.itemx2-boot-card{position:fixed;left:50%;top:50%;z-index:53;display:flex;align-items:center;gap:11px;min-width:220px;max-width:calc(100vw - 32px);padding:14px 16px;border:1px solid rgba(212,175,110,.52);border-radius:14px;background:rgba(9,13,23,.96);box-shadow:0 18px 50px rgba(0,0,0,.58),0 0 22px rgba(212,175,110,.12);color:#f0dfb9;transform:translate(-50%,-50%);font-size:12px;font-weight:800}.itemx2-boot-card i{width:18px;height:18px;flex:0 0 auto;border:2px solid rgba(240,223,185,.22);border-top-color:#f0c979;border-radius:50%;animation:itemx2-aux-spin .8s linear infinite}.itemx2-boot-card span{display:grid;gap:2px}.itemx2-boot-card small{color:#8190a7;font-size:10px;font-weight:600}
.itemx2-feedback{position:fixed;left:50%;top:calc(14px + env(safe-area-inset-top,0px));z-index:54;max-width:calc(100vw - 32px);padding:9px 13px;border:1px solid #354157;border-radius:999px;background:rgba(9,13,23,.96);box-shadow:0 10px 30px rgba(0,0,0,.5);color:#dbe4f2;font-size:11px;font-weight:800;line-height:1.35;text-align:center;opacity:0;visibility:hidden;transform:translate(-50%,-7px);transition:opacity .14s ease,transform .14s ease,visibility 0s .14s;pointer-events:none}.itemx2-feedback-on{opacity:1;visibility:visible;transform:translate(-50%,0);transition:opacity .14s ease,transform .14s ease}.itemx2-feedback-success{border-color:#37634d;color:#a9e6c2}.itemx2-feedback-error{border-color:#61343a;color:#ffadb5}.itemx2-feedback-working{border-color:#6a5530;color:#e8c987}
.itemx2-root-layer{position:fixed;inset:0;pointer-events:none;visibility:visible;opacity:1;transition:opacity .16s ease,visibility 0s}
.itemx2-root-drawer .itemx2-root-panel{position:fixed;display:flex;flex-direction:column;width:min(420px,calc(100vw - 66px));height:min(700px,72dvh);max-height:calc(100dvh - 24px);margin:0;overflow:hidden;pointer-events:auto;border-radius:16px;box-shadow:0 18px 50px rgba(0,0,0,.58)}
.itemx2-root-pos-lb{left:60px;bottom:12px}.itemx2-root-pos-lm{left:60px;top:50%;transform:translateY(-50%)}.itemx2-root-pos-lt{left:60px;top:12px}
.itemx2-root-pos-rb{right:60px;bottom:12px}.itemx2-root-pos-rm{right:60px;top:50%;transform:translateY(-50%)}.itemx2-root-pos-rt{right:60px;top:12px}
.itemx2-root-drawer.itemx2-is-open .itemx2-root-panel{animation:itemx2-root-in .19s cubic-bezier(.2,.78,.2,1) both}.itemx2-root-drawer:not(.itemx2-is-open) .itemx2-root-layer{opacity:0;visibility:hidden;transition:opacity .14s ease,visibility 0s .14s}
.itemx2-root-drawer:not(.itemx2-is-open) .itemx2-root-panel{pointer-events:none;animation:itemx2-root-out .14s ease both}
.itemx2-root-drawer:not(.itemx2-is-open) .itemx-card *{animation-play-state:paused!important}
.itemx2-root-close,.itemx2-root-back{cursor:pointer}${ITEMX_SETTINGS_STYLE}
.itemx-main-tabs{display:grid;grid-template-columns:repeat(4,1fr);border-bottom:1px solid #171d2b}.itemx-main-tab{min-height:44px;display:grid;place-items:center;border-bottom:2px solid transparent;background:#0d121c;color:#77839c;cursor:pointer;font-size:.72rem;font-weight:800}
.itemx2-root-skills,.itemx2-root-bestiary{display:none;flex:1;min-height:0;overflow-y:auto;overscroll-behavior:contain;touch-action:pan-y;-webkit-overflow-scrolling:touch;padding:12px;background:#090e16}.itemx2-tab-skills:checked~.itemx2-root-layer .itemx2-root-inventory,.itemx2-tab-skills:checked~.itemx2-root-layer .itemx2-root-settings,.itemx2-tab-bestiary:checked~.itemx2-root-layer .itemx2-root-inventory,.itemx2-tab-bestiary:checked~.itemx2-root-layer .itemx2-root-settings{display:none}.itemx2-tab-skills:checked~.itemx2-root-layer .itemx2-root-skills,.itemx2-tab-bestiary:checked~.itemx2-root-layer .itemx2-root-bestiary{display:grid;align-content:start;gap:9px}.itemx2-tab-inventory:checked~.itemx2-root-layer label[for="itemx2-tab-inventory"],.itemx2-tab-skills:checked~.itemx2-root-layer label[for="itemx2-tab-skills"],.itemx2-tab-bestiary:checked~.itemx2-root-layer label[for="itemx2-tab-bestiary"],.itemx2-tab-settings:checked~.itemx2-root-layer label[for="itemx2-tab-settings"]{border-bottom-color:#d4af6e;color:#f3dcaa;background:#121925}
.itemx2-codex-card{position:relative;display:block;min-height:70px;border:1px solid #263247;border-radius:12px;background:linear-gradient(145deg,#121a28,#0b111b);overflow:hidden}.itemx2-codex-summary{position:relative;z-index:1;display:grid;grid-template-columns:48px minmax(0,1fr) minmax(72px,auto);gap:10px;align-items:center;min-height:70px;padding:10px;cursor:pointer;list-style:none}.itemx2-codex-summary::-webkit-details-marker{display:none}.itemx2-codex-summary::after{content:'＋';position:absolute;right:8px;bottom:5px;color:#66758d;font-size:var(--itemx-text-sm,.7rem)}.itemx2-codex-card[open]>.itemx2-codex-summary::after{content:'－';color:#d4af6e}.itemx2-codex-glyph{display:grid;place-items:center;width:48px;height:48px;border:1px solid #40506b;border-radius:11px;background:#0b111c;color:#dbe8ff;font-size:1.45rem}.itemx2-codex-copy{display:grid;gap:3px;min-width:0}.itemx2-codex-copy strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#edf2fb;font-size:var(--itemx-text-md,.82rem)}.itemx2-codex-copy small{color:#8494ad;font-size:var(--itemx-text-xs,.66rem)}.itemx2-codex-tags{display:flex;flex-wrap:wrap;gap:4px}.itemx2-codex-tags i{padding:2px 5px;border:1px solid #344259;border-radius:999px;color:#aebbd0;font-size:calc(var(--itemx-text-xs,.62rem) * .94);font-style:normal}.itemx2-codex-detail{position:relative;z-index:1;display:grid;gap:8px;padding:10px 12px 12px;border-top:1px solid #202b3c;background:rgba(7,11,18,.72);color:#b8c4d7;font-size:var(--itemx-text-sm,.68rem);line-height:1.55}.itemx2-codex-detail p{margin:0;color:#c8d2e1;white-space:pre-wrap}.itemx2-codex-detail-row{display:grid;grid-template-columns:64px minmax(0,1fr);gap:8px}.itemx2-codex-detail-row b{color:#74849d;font-size:var(--itemx-text-xs,.62rem)}.itemx2-codex-detail-row span{overflow-wrap:anywhere}.itemx2-skill-meta{position:relative;z-index:1;display:grid;grid-template-columns:auto auto;gap:2px 5px;align-items:center;padding:6px 7px;border:1px solid #2e3a50;border-radius:9px;background:rgba(9,14,23,.82);font-size:var(--itemx-text-xs,.58rem)}.itemx2-skill-meta small{color:#6f809a}.itemx2-skill-meta b{color:#dce6f5;font-size:var(--itemx-text-xs,.62rem);text-align:right}.itemx2-mastery{grid-column:2/-1;display:grid;grid-template-columns:repeat(5,1fr);gap:4px}.itemx2-mastery i{height:5px;border-radius:6px;background:#202a3a;overflow:hidden}.itemx2-mastery i.on{background:linear-gradient(90deg,#66b8ff,#a985ff);box-shadow:0 0 8px rgba(102,184,255,.35)}.itemx2-bestiary-card.active{border-color:#70404a;box-shadow:inset 3px 0 #b55b68}.itemx2-bestiary-card img{width:48px;height:48px;border-radius:11px;object-fit:cover}.itemx2-codex-empty{padding:34px 16px;text-align:center;color:#6f7e96;font-size:var(--itemx-text-sm,.75rem)}.itemx2-codex-note{padding:9px 10px;border:1px solid #1c2635;border-radius:9px;background:#0c121c;color:#8594aa;font-size:var(--itemx-text-xs,.66rem);line-height:1.45}.itemx2-root-drawer.itemx2-font-large .itemx2-codex-card,.itemx2-root-drawer.itemx2-font-large .itemx2-codex-summary{min-height:76px}
.itemx-tile,.itemx2-codex-card{content-visibility:auto;contain:layout paint style}.itemx-tile{contain-intrinsic-size:92px}.itemx2-codex-card{contain-intrinsic-size:78px}
.itemx2-root-inventory{display:flex;flex:1;min-height:0;flex-direction:column;overflow:hidden}.itemx2-root-inventory>.itemx-body{flex:1;min-height:0;overflow-x:hidden;overflow-y:auto;overscroll-behavior:contain;touch-action:pan-y;-webkit-overflow-scrolling:touch;padding-bottom:calc(.95em + env(safe-area-inset-bottom,0px))}
.itemx2-root-inventory>.itemx-pf{display:flex;align-items:center;justify-content:space-between;gap:8px}.itemx2-root-pager{display:inline-flex;align-items:center;gap:7px}.itemx2-root-pager button{width:30px;height:28px;border:1px solid #2d394c;border-radius:7px;background:#151d2a;color:#d9e4f3;font:inherit;font-weight:900}.itemx2-root-pager button:disabled{opacity:.3}.itemx2-root-pager b{min-width:42px;color:#9eabc0;font-size:.65rem;text-align:center}
.itemx2-root-item{display:block}.itemx2-root-tile-label{display:block;cursor:pointer}.itemx2-root-tile-label .itemx-tile{width:100%;pointer-events:none}
.itemx2-root-detail{display:none}.itemx2-root-panel:has(.itemx2-root-detail-choice:checked) .itemx2-root-filters,.itemx2-root-panel:has(.itemx2-root-detail-choice:checked) .itemx2-root-tools,.itemx2-root-panel:has(.itemx2-root-detail-choice:checked) .itemx-pf{display:none}.itemx2-root-settings{display:none}.itemx2-tab-settings:checked~.itemx2-root-layer .itemx2-root-inventory,.itemx2-tab-settings:checked~.itemx2-root-layer .itemx2-root-skills,.itemx2-tab-settings:checked~.itemx2-root-layer .itemx2-root-bestiary{display:none}.itemx2-tab-settings:checked~.itemx2-root-layer .itemx2-root-settings{display:grid;gap:10px}
.itemx2-root-tab-body{display:flex;flex:1;min-height:0;flex-direction:column;overflow:hidden}.itemx2-root-tab-body>.itemx2-root-skills,.itemx2-root-tab-body>.itemx2-root-bestiary{display:grid;align-content:start;gap:9px}.itemx2-root-tab-body>.itemx2-root-settings{display:grid;gap:10px}.itemx-main-tab-on{border-bottom-color:#d4af6e!important;color:#f3dcaa!important;background:#121925!important}.itemx2-tab-loading{display:grid;flex:1;min-height:0;place-content:center;justify-items:center;gap:10px;padding:24px;color:#b7c3d6;text-align:center}.itemx2-tab-loading i{width:28px;height:28px;border:2px solid rgba(212,175,110,.2);border-top-color:#d4af6e;border-radius:50%;animation:itemx2-tab-spin .7s linear infinite}.itemx2-tab-loading strong{color:#f0dfb8;font-size:.78rem}.itemx2-tab-loading small{color:#718097;font-size:.66rem}@keyframes itemx2-tab-spin{to{transform:rotate(360deg)}}.itemx2-pos-lb:checked~.itemx2-root-layer label[for="itemx2-pos-lb"],.itemx2-pos-lm:checked~.itemx2-root-layer label[for="itemx2-pos-lm"],.itemx2-pos-lt:checked~.itemx2-root-layer label[for="itemx2-pos-lt"],.itemx2-pos-rb:checked~.itemx2-root-layer label[for="itemx2-pos-rb"],.itemx2-pos-rm:checked~.itemx2-root-layer label[for="itemx2-pos-rm"],.itemx2-pos-rt:checked~.itemx2-root-layer label[for="itemx2-pos-rt"]{border-color:#d4af6e;background:#292316;color:#f3dcaa}.itemx2-status-chip-on{border-color:#37634d;color:#9cddb7;background:#102019}.itemx2-status-chip-off{border-color:#61343a;color:#efa8af;background:#251216}.itemx2-setting-cleanup-armed{box-shadow:0 0 0 1px #b85b67 inset!important}.itemx2-aux-status-done i,.itemx2-aux-status-failed i{border:0!important;animation:none!important}.itemx2-aux-status-done i::before{content:'✓';color:#9cddb7;font-style:normal;font-weight:900}.itemx2-aux-status-failed i::before{content:'!';color:#ffadb5;font-style:normal;font-weight:900}.itemx2-manager-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;align-items:center;padding:9px;border:1px solid #1d2737;border-radius:9px;background:#101722}.itemx2-manager-name{display:grid;gap:2px;min-width:0}.itemx2-manager-name strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#e9eef7;font-size:.78rem}.itemx2-manager-name small{color:#6f7e96;font-size:.67rem}
.itemx2-root-panel:has(.itemx2-root-detail-choice:checked) .itemx2-root-item{display:none}.itemx2-root-panel .itemx2-root-item:has(.itemx2-root-detail-choice:checked){display:block}.itemx2-root-detail-choice:checked~.itemx2-root-tile-label{display:none}.itemx2-root-detail-choice:checked~.itemx2-root-detail{display:block}
.itemx2-root-panel:has(.itemx2-root-detail-choice:checked) .itemx-grid{grid-template-columns:minmax(0,1fr)}.itemx2-root-panel:has(.itemx2-root-detail-choice:checked) .itemx2-root-item:has(.itemx2-root-detail-choice:checked){grid-column:1/-1;width:100%;min-width:0}.itemx2-root-panel:has(.itemx2-root-detail-choice:checked) .itemx-detail{width:100%}
.itemx2-root-filter-owned:checked~.itemx2-root-layer .itemx2-root-item:not(.itemx2-match-owned),.itemx2-root-filter-equipped:checked~.itemx2-root-layer .itemx2-root-item:not(.itemx2-match-equipped),.itemx2-root-filter-observed:checked~.itemx2-root-layer .itemx2-root-item:not(.itemx2-match-observed),.itemx2-root-filter-removed:checked~.itemx2-root-layer .itemx2-root-item:not(.itemx2-match-removed){display:none}
.itemx2-root-filter-all:checked~.itemx2-root-layer label[for="itemx2-filter-all"],.itemx2-root-filter-owned:checked~.itemx2-root-layer label[for="itemx2-filter-owned"],.itemx2-root-filter-equipped:checked~.itemx2-root-layer label[for="itemx2-filter-equipped"],.itemx2-root-filter-observed:checked~.itemx2-root-layer label[for="itemx2-filter-observed"],.itemx2-root-filter-removed:checked~.itemx2-root-layer label[for="itemx2-filter-removed"]{border-bottom-color:#d4af6e;color:#f2ead9;font-weight:700}
@keyframes itemx2-root-in{from{opacity:0;translate:0 7px;scale:.982}to{opacity:1;translate:0;scale:1}}@keyframes itemx2-root-out{from{opacity:1}to{opacity:0;translate:0 5px;scale:.988}}@keyframes itemx2-aux-spin{to{transform:rotate(360deg)}}
@media(max-width:520px){.itemx2-root-drawer .itemx2-root-panel{width:calc(100vw - 68px);height:min(660px,72dvh)}.itemx2-root-pos-lb,.itemx2-root-pos-lm,.itemx2-root-pos-lt{left:56px;right:auto;top:auto;bottom:8px;transform:none}.itemx2-root-pos-rb,.itemx2-root-pos-rm,.itemx2-root-pos-rt{right:56px;left:auto;top:auto;bottom:8px;transform:none}}
@media(prefers-reduced-motion:reduce){.itemx2-root-layer,.itemx2-root-panel,.itemx2-aux-status i{animation:none!important;transition:none!important}}
${codexPageStyle()}
`;

  function prefixRisuClasses(css) {
    return String(css || '').replace(/\.([a-zA-Z][\w-]*)/g, (_, name) =>
      name.startsWith('x-risu-') ? `.${name}` : `.x-risu-${name}`
    );
  }

  const bodyScrollStyle = `.chattext.x-risu-itemx-body-scrolling .x-risu-itemx-inline-card .x-risu-itemx-fx,.chattext.x-risu-itemx-body-scrolling .x-risu-itemx-inline-card .x-risu-itemx-cond,.chattext.x-risu-itemx-body-scrolling .x-risu-itemx2-inline-event::before,.chattext.x-risu-itemx-body-scrolling .x-risu-itemx2-inline-event::after,.chattext.x-risu-itemx-body-scrolling .x-risu-itemx2-inline-main::before,.chattext.x-risu-itemx-body-scrolling .x-risu-itemx2-inline-icon::before,.chattext.x-risu-itemx-body-scrolling .x-risu-itemx2-inline-warning{visibility:hidden!important}.chattext.x-risu-itemx-body-scrolling .x-risu-itemx-inline-card,.chattext.x-risu-itemx-body-scrolling .x-risu-itemx2-inline-event{box-shadow:none!important}.chattext.x-risu-itemx-body-scrolling .x-risu-itemx-inline-card .x-risu-itemx-fx,.chattext.x-risu-itemx-body-scrolling .x-risu-itemx-inline-card .x-risu-itemx-fx *,.chattext.x-risu-itemx-body-scrolling .x-risu-itemx-inline-card .x-risu-itemx-cond,.chattext.x-risu-itemx-body-scrolling .x-risu-itemx-inline-card .x-risu-itemx-cond *,.chattext.x-risu-itemx-body-scrolling .x-risu-itemx2-inline-event::before,.chattext.x-risu-itemx-body-scrolling .x-risu-itemx2-inline-event::after,.chattext.x-risu-itemx-body-scrolling .x-risu-itemx2-inline-main::before,.chattext.x-risu-itemx-body-scrolling .x-risu-itemx2-inline-icon::before,.chattext.x-risu-itemx-body-scrolling .x-risu-itemx2-inline-warning{animation-play-state:paused!important;filter:none!important;mix-blend-mode:normal!important;box-shadow:none!important}.chattext.x-risu-itemx-body-scrolling :is(.x-risu-itemx-inline-card,.x-risu-itemx2-inline-event),.chattext.x-risu-itemx-body-scrolling :is(.x-risu-itemx-inline-card,.x-risu-itemx2-inline-event)::before,.chattext.x-risu-itemx-body-scrolling :is(.x-risu-itemx-inline-card,.x-risu-itemx2-inline-event)::after,.chattext.x-risu-itemx-body-scrolling :is(.x-risu-itemx-inline-card,.x-risu-itemx2-inline-event) *,.chattext.x-risu-itemx-body-scrolling :is(.x-risu-itemx-inline-card,.x-risu-itemx2-inline-event) *::before,.chattext.x-risu-itemx-body-scrolling :is(.x-risu-itemx-inline-card,.x-risu-itemx2-inline-event) *::after{animation-play-state:paused!important}`;

  const bodyEffectsStyle = `body.x-risu-itemx2-effects-off .x-risu-itemx-fx,body.x-risu-itemx2-effects-off .x-risu-itemx-cond,body.x-risu-itemx2-effects-off .x-risu-itemx-codex-hero::before,body.x-risu-itemx2-effects-off .x-risu-itemx-codex-hero::after,body.x-risu-itemx2-effects-off .x-risu-itemx2-codex-fx,body.x-risu-itemx2-effects-off .x-risu-itemx2-inline-event::after,body.x-risu-itemx2-effects-off .x-risu-itemx2-inline-icon::before,body.x-risu-itemx2-effects-off .x-risu-itemx2-inline-body,body.x-risu-itemx2-effects-off .x-risu-itemx2-inline-scan,body.x-risu-itemx2-effects-off .x-risu-itemx2-inline-encounter .x-risu-itemx2-inline-icon::after,body.x-risu-itemx2-effects-off .x-risu-itemx2-inline-warning{display:none!important;animation:none!important}`;

  const ITEMX_CONTROL_STYLE = `.itemx2-seg{display:grid;grid-auto-flow:column;grid-auto-columns:1fr;gap:3px;flex:0 0 100%;margin-top:2px;padding:3px;border:1px solid #2b3547;border-radius:10px;background:#121926}.itemx2-seg-btn{min-height:30px;padding:0 8px;border:0;border-radius:7px;background:transparent;color:#8a97ad;font:inherit;font-size:.68rem;font-weight:700;cursor:pointer;white-space:nowrap}.itemx2-seg-on{background:#22304a;color:#f1f5fb;font-weight:800;box-shadow:0 1px 3px rgba(0,0,0,.3)}.itemx2-font-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:7px}.itemx2-position-grid{display:grid;gap:8px}.itemx2-set-group{display:flex;align-items:center;gap:8px;margin:6px 2px 0;font-size:.58rem;font-weight:800;letter-spacing:.2em;color:#7a8aa3}.itemx2-set-group::after{content:'';flex:1;height:1px;background:#232f42}.itemx2-danger-zone{display:grid;gap:8px;padding:11px;border:1px solid #6b3540;border-radius:12px;background:rgba(150,50,66,.08)}.itemx2-danger-zone>h4{margin:0;font-size:.58rem;font-weight:800;letter-spacing:.16em;color:#e0697c}.itemx2-danger-zone>.itemx2-root-setting-card{border:0;background:transparent;padding:0}.itemx2-danger-zone .itemx2-root-setting-button{border-color:#a3505d;color:#ffb3bd}.itemx2-sw{position:relative;flex:0 0 auto;width:44px;min-width:44px;height:26px;min-height:26px!important;max-height:26px;padding:0!important;box-sizing:border-box;border-radius:999px!important;border:1px solid #33405a!important;background:#1a2331!important;cursor:pointer;transition:background .15s ease,border-color .15s ease}.itemx2-sw>i{position:absolute;left:3px;top:3px;width:18px;height:18px;border-radius:50%;background:#8394ad;transition:transform .15s ease,background .15s ease}.itemx2-sw.itemx-setting-on,.itemx2-sw.itemx2-setting-on{border-color:#4e8968!important;background:#173226!important;color:transparent!important}.itemx2-sw.itemx-setting-on>i,.itemx2-sw.itemx2-setting-on>i{transform:translateX(18px);background:#a9e6c2}.itemx2-position-map{position:relative;width:100%;max-width:230px;aspect-ratio:16/10;margin:2px auto 0;border:1px solid #2b3547;border-radius:10px;background:#101724;overflow:hidden}.itemx2-position-screen{position:absolute;inset:0;display:grid;place-items:center;color:#5d6a80;font-size:.6rem;pointer-events:none}.itemx2-position-map .itemx2-position-choice{position:absolute;width:18px;height:34px;min-height:0;padding:0;border-radius:5px;border:1px solid #33405a;background:#1a2331;cursor:pointer}.itemx2-position-map .itemx2-position-lt{left:7px;top:7px}.itemx2-position-map .itemx2-position-lm{left:7px;top:50%;transform:translateY(-50%)}.itemx2-position-map .itemx2-position-lb{left:7px;bottom:7px}.itemx2-position-map .itemx2-position-rt{right:7px;top:7px}.itemx2-position-map .itemx2-position-rm{right:7px;top:50%;transform:translateY(-50%)}.itemx2-position-map .itemx2-position-rb{right:7px;bottom:7px}.itemx2-position-map .itemx2-position-on{border-color:#d4af6e;background:#d4af6e;box-shadow:0 0 10px rgba(212,175,110,.55)}.itemx2-position-hint{margin:7px 2px 0;color:#8a97ad;font-size:.64rem;text-align:center}.itemx2-position-hint b{color:#dfe7f3}.itemx2-font-choice{display:grid!important;gap:2px;place-items:center;min-height:52px!important;padding:7px 4px!important}.itemx2-font-choice>em{font-style:normal;font-weight:800;line-height:1.15}.itemx2-font-choice>span{font-size:.58rem;opacity:.8}.itemx2-setting-font-small>em{font-size:.78rem}.itemx2-setting-font-medium>em{font-size:.95rem}.itemx2-setting-font-large>em{font-size:1.16rem}.itemx2-domain-card>i{font-style:normal;font-size:.55rem;font-weight:800;letter-spacing:.06em;color:#7a8aa3}.itemx2-domain-card.itemx-setting-on>i,.itemx2-domain-card.itemx2-setting-on>i{color:#a9e6c2}`;

  const SKIN_PALETTES = {
    frost: {
      lineRGB: '96,116,140',
      glowRGB: '86,150,200',
      shadowRGB: '60,80,105',
      gaugeRGB: '50,120,175',
      dangerRGB: '150,60,95',
      paperHi: '#cfdbea',
      paper: '#b0c3da',
      inset: 'rgba(96,118,145,.18)',
      ink: '#111826',
      ink2: '#16202f',
      ink3: '#18222f',
      fg: '#222c3a',
      body: '#3c4757',
      dim: '#6a7889',
      dim2: '#78869a',
      dim3: '#77869a',
      dim4: '#566476',
      muted: '#7b899c',
      accent: '#2f6f9e',
      accentDeep: '#245a80',
      accentSeg: '#3b82b8',
      segInk: '#1d2839',
      btnInk: '#2e3a4b',
      histInk: '#2c3746',
      chipInk: '#3a4657',
      tileRkInk: '#141d2b',
      repairInk: '#215274',
      changeEm: '#1f4f74',
      lineStrong: '#b7c6d7',
      lineCard: '#a9bacd',
      repairLine: '#8fa8c2',
      surface: '#eef3f9',
      surfHi: '#f6fafd',
      surfLo: '#e4ecf5',
      raise: '#f5f9fd',
      tileA: '#f8fbfe',
      tileB: '#e7eef7',
      tileHover: '#fbfdff',
      input: '#e9f0f8',
      inputHi: '#fbfdff',
      manager: '#f2f7fc',
      histBtn: '#f6fafe',
      heroA: '#d0dcec',
      heroB: '#b6c8dd',
      medalA: '#fafdff',
      medalB: '#e0e9f4',
      statA: '#f8fbfe',
      statB: '#e8eff8',
      gaugeOff: '#ccd8e6',
      gaugeA: '#4a9fd8',
      gaugeB: '#2f6f9e',
      dangerA: '#f6eef2',
      dangerB: '#e6e3ee',
      dangerLine: '#a4849c',
      dangerInk: '#8e2f4d',
      dangerBanner: 'rgba(246,238,245,.88)',
      dangerSoft: 'rgba(150,60,95,.09)',
      onSoft: 'rgba(47,125,91,.14)',
      seg2: '#e4ecf5',
      segOn: '#ffffff',
      changeBg: 'rgba(246,250,254,.94)',
      repairBg: '#eef4fb',
      tileEq: '#4a9fd8',
      fxFilter: 'saturate(.92)',
      fxOpacity: '1'
    },
    hanji: {
      lineRGB: '120,95,55',
      glowRGB: '176,134,58',
      shadowRGB: '96,72,38',
      gaugeRGB: '160,110,20',
      dangerRGB: '178,52,74',
      paperHi: '#ddcfa9',
      paper: '#c2ae84',
      inset: 'rgba(126,99,56,.22)',
      ink: '#241a0c',
      ink2: '#2c2113',
      ink3: '#2e2413',
      fg: '#33291a',
      body: '#4c4028',
      dim: '#7c6a49',
      dim2: '#8a7a5c',
      dim3: '#87765a',
      dim4: '#6d5a35',
      muted: '#96835f',
      accent: '#8a621f',
      accentDeep: '#6b4c12',
      accentSeg: '#a8781f',
      segInk: '#3d2f14',
      btnInk: '#4c3d20',
      histInk: '#3d3320',
      chipInk: '#5b4b2e',
      tileRkInk: '#2c2210',
      repairInk: '#5b4310',
      changeEm: '#5b3f0c',
      lineStrong: '#c3ae86',
      lineCard: '#b6a077',
      repairLine: '#b79a63',
      surface: '#f4ecda',
      surfHi: '#f8f1e0',
      surfLo: '#efe4cb',
      raise: '#faf4e4',
      tileA: '#fbf5e6',
      tileB: '#f1e7d1',
      tileHover: '#fdf8ec',
      input: '#f3e9d5',
      inputHi: '#fdf8ec',
      manager: '#f7f0de',
      histBtn: '#f9f3e3',
      heroA: '#dfd0aa',
      heroB: '#c8b58c',
      medalA: '#fdf6e4',
      medalB: '#eaddc0',
      statA: '#fbf5e6',
      statB: '#f2e8d3',
      gaugeOff: '#dfd2b6',
      gaugeA: '#c8901f',
      gaugeB: '#9a6b1f',
      dangerA: '#f7e6de',
      dangerB: '#efdcc8',
      dangerLine: '#b8776f',
      dangerInk: '#9c2a3e',
      dangerBanner: 'rgba(250,235,230,.86)',
      dangerSoft: 'rgba(150,40,60,.09)',
      onSoft: 'rgba(79,122,74,.15)',
      seg2: '#e9dec6',
      segOn: '#fffdf6',
      changeBg: 'rgba(250,244,228,.94)',
      repairBg: '#f6ecd4',
      tileEq: '#c8901f',
      fxFilter: 'saturate(.82)',
      fxOpacity: '1'
    }
  };

  const SKIN_NAMES = Object.keys(SKIN_PALETTES);

  const SKIN_LABELS = { dark: ITEMXText("style.005"), frost: ITEMXText("style.004"), hanji: ITEMXText("style.003") };

  const SKIN_MODES = ['dark', ...SKIN_NAMES];

  function skinCss(name) {
    const c = SKIN_PALETTES[name],
      S = `.itemx2-skin-${name}`,
      line = (alpha) => `rgba(${c.lineRGB},${alpha})`;
    return [
      // Card surface and type.
      `${S} .itemx-card{--fg:${c.fg};--dim:${c.dim};--line:${c.lineCard};--surf:${line('.12')};--inset-sh:inset 0 0 46px ${c.inset};background:repeating-linear-gradient(102deg,${line('.04')} 0 2px,transparent 2px 7px),repeating-linear-gradient(11deg,${line('.03')} 0 3px,transparent 3px 9px),radial-gradient(120% 80% at 50% -10%,${c.paperHi},${c.paper} 70%);color:var(--fg);box-shadow:var(--inset-sh),0 0 calc(20px*var(--int)) var(--pg),0 10px 26px rgba(${c.shadowRGB},.24)}`,
      `${S} .itemx-name{color:${c.ink};text-shadow:none}`,
      `${S} .rarity-epic .itemx-name,${S} .rarity-legendary .itemx-name,${S} .rarity-mythical .itemx-name,${S} .rarity-empyrean .itemx-name{color:color-mix(in srgb,var(--rk) 42%,${c.ink2});text-shadow:none}`,
      `${S} .itemx-medallion{background:radial-gradient(circle at 32% 28%,${c.medalA},${c.medalB} 72%)}`,
      `${S} .itemx-tier{color:color-mix(in srgb,var(--rk) 45%,${c.segInk});border-color:color-mix(in srgb,var(--rk) 60%,transparent)}`,
      `${S} .itemx-eyebrow,${S} .itemx-subline{color:${c.dim}}`,
      `${S} .itemx-fx{opacity:${c.fxOpacity};filter:${c.fxFilter}}`,
      `${S} .itemx-cond{mix-blend-mode:multiply;opacity:.55}`,

      `${S} .affinity-chip{color:color-mix(in srgb,var(--chip) 45%,${c.chipInk})}`,
      `${S} .reaction-chip{color:${c.accentDeep}}`,
      `${S} .itemx-oriental-seal{background:rgba(155,32,38,.78);color:#ffe9df}`,
      `${S} .itemx-edge{opacity:calc(.55*var(--int))}`,
      // Panel shell: header, tabs, tools, list body, footer.
      `:is(${S} .itemx-panel,.itemx-panel${S}){border-color:${c.lineStrong};background:${c.surface};color:${c.fg};box-shadow:0 18px 50px rgba(${c.shadowRGB},.3)}`,
      `${S} .itemx-ph{border-bottom-color:${line('.28')};background:radial-gradient(120% 150% at 18% -40%,rgba(${c.glowRGB},.14),transparent 55%),linear-gradient(180deg,${c.surfHi},${c.surfLo})}`,
      `${S} .itemx-ph-eyebrow{color:${c.accent}}`,
      `${S} .itemx-ph-title{color:${c.ink2}}`,
      `${S} .itemx-ph-sub,${S} .itemx-pf{color:${c.dim}}`,
      `${S} .itemx-ph-btn{border-color:${line('.28')};background:rgba(255,255,255,.5);color:${c.dim4}}`,
      `${S} .itemx-seg{border-bottom-color:${line('.24')}}`,
      `${S} .itemx-seg-i{color:${c.dim2}}`,
      `${S} .itemx-seg-on{border-bottom-color:${c.accentSeg};color:${c.segInk}}`,
      `${S} .itemx-tool,${S} .itemx-search{border-color:${line('.3')};background:rgba(255,255,255,.48);color:${c.dim4}}`,
      `${S} .itemx-pf{border-top-color:${line('.24')}}`,
      `${S} .itemx-empty,${S} .itemx2-root-empty{color:${c.dim2}}`,
      // Inventory tiles.
      `${S} .itemx-tile{border-color:${line('.28')};background:linear-gradient(160deg,${c.tileA},${c.tileB} 78%)}`,
      `${S} .itemx-tile:hover,${S} .itemx-tile:focus-visible{background:${c.tileHover}}`,
      `${S} .itemx-tile-nm{color:${c.ink3}}`,
      `${S} .itemx-tile-lc{color:${c.dim3}}`,
      `${S} .itemx-tile-rk{color:color-mix(in srgb,var(--rk) 58%,${c.tileRkInk})}`,
      `${S} .itemx-tile-em{background:radial-gradient(85% 85% at 50% 28%,var(--rks),transparent 80%)}`,
      `${S} .itemx-tile-eq{border-top-color:${c.tileEq}}`,
      // Codex heroes: skills and bestiary.
      `${S} .itemx-codex-hero{border-color:${c.lineStrong};background:radial-gradient(circle at 50% 45%,rgba(${c.glowRGB},.18),transparent 31%),linear-gradient(145deg,${c.heroA},${c.heroB} 70%);box-shadow:inset 0 0 45px rgba(${c.glowRGB},.12),0 12px 34px rgba(${c.shadowRGB},.2)}`,
      `${S} .itemx-codex-hero-glyph{border-color:rgba(${c.glowRGB},.5);background:radial-gradient(circle at 45% 38%,${c.medalA},${c.heroB} 68%);color:${c.segInk};text-shadow:none}`,
      `${S} .itemx-codex-hero-copy small{color:${c.dim2}}`,
      `${S} .itemx-codex-hero-copy strong{color:${c.ink2}}`,
      `${S} .itemx-codex-hero-copy span{color:${c.dim}}`,
      `${S} .itemx-codex-stat{border-color:${line('.3')};background:linear-gradient(145deg,${c.statA},${c.statB})}`,
      `${S} .itemx-codex-stat small{color:${c.dim2}}`,
      `${S} .itemx-codex-stat strong{color:${c.ink3}}`,
      `${S} .itemx-codex-section{border-color:${line('.28')};background:${c.raise};color:${c.body}}`,
      `${S} .itemx-codex-section h4{color:${c.segInk}}`,
      `${S} .itemx-codex-chip-row i{border-color:${line('.32')};background:${c.input};color:${c.chipInk}}`,
      `${S} .itemx-codex-mastery i{background:${c.gaugeOff}}`,
      `${S} .itemx-codex-mastery i.on{background:linear-gradient(90deg,${c.gaugeA},${c.gaugeB});box-shadow:0 0 6px rgba(${c.gaugeRGB},.35)}`,
      `${S} .itemx-codex-back,${S} .itemx2-root-back{border-color:${line('.34')};background:${c.input};color:${c.btnInk}}`,
      `${S} .itemx-codex-fold{border-color:${line('.28')};background:${c.raise}}`,
      `${S} .itemx-codex-fold summary strong{color:${c.ink3}}`,
      `${S} .itemx-codex-fold summary small{color:${c.dim2}}`,
      `${S} .itemx-codex-detail{border-top-color:${line('.24')};color:${c.body}}`,
      `${S} .itemx-codex-detail b{color:${c.dim2}}`,
      // The bestiary hero keeps its warning identity, tuned for a light surface.
      `${S} .itemx-monster-hero{border-color:${c.dangerLine};background:radial-gradient(circle at 50% 40%,rgba(${c.dangerRGB},.16),transparent 34%),linear-gradient(145deg,${c.dangerA},${c.dangerB} 72%);box-shadow:inset 0 0 54px rgba(${c.dangerRGB},.1),0 12px 34px rgba(${c.shadowRGB},.22)}`,
      `${S} .itemx-threat-banner{border-color:rgba(${c.dangerRGB},.45);background:${c.dangerBanner};color:${c.dangerInk}}`,
      // Settings and history surfaces.
      `${S} .itemx2-root-setting-card{border-color:${line('.28')};background:${c.raise}}`,
      `${S} .itemx2-root-setting-card strong{color:${c.ink3}}`,
      `${S} .itemx2-root-setting-card small{color:${c.dim2}}`,
      `${S} .itemx2-root-setting-button{border-color:${line('.36')};background:${c.input};color:${c.btnInk}}`,
      `${S} .itemx-setting-on{border-color:#5f8f6d;color:#2f6144}`,
      `${S} .itemx-manager{border-color:${line('.34')};background:${c.manager}}`,
      `${S} .itemx-manager-title{color:${c.accent}}`,
      `${S} .itemx-manager-field{color:${c.dim}}`,
      `${S} .itemx-manager-field select,${S} .itemx-manager-field textarea{border-color:${line('.32')};background:${c.inputHi};color:${c.fg}}`,
      `${S} .itemx-manager-current,${S} .itemx-manager-help{color:${c.dim3}}`,
      `${S} .itemx2-history-pane{background:${c.surface};color:${c.body}}`,
      `${S} .itemx2-history-pane button{border-color:${line('.3')};background:${c.histBtn};color:${c.histInk}}`,
      `${S} .itemx2-history-row{border-color:${line('.28')}}`,
      `${S} .itemx2-history-row small,${S} .itemx2-history-policy small{color:${c.dim3}}`,
      `${S} .itemx2-change-note,${S} .itemx2-review-note{border-color:${line('.3')};background:${c.changeBg};color:${c.body}}`,
      `${S} .itemx2-change-note>strong{color:${c.accentDeep}}`,
      `${S} .itemx2-change-note em{color:${c.changeEm}}`,
      `${S} .itemx2-change-note del,${S} .itemx2-change-note small,${S} .itemx2-change-note b{color:${c.dim2}}`,
      `${S} .itemx2-repair-one{border-color:${c.repairLine};background:${c.repairBg};color:${c.repairInk}}`,
      // Tabs, choice grids and the remaining controls. The drawer marks its active tab
      // through a :checked sibling, so that selector is skinned alongside the class form.
      `${S} .itemx-main-tabs{border-bottom-color:${line('.24')}}`,
      `${S} .itemx-main-tab{background:${c.surfLo};color:${c.dim2}}`,
      `${S} .itemx-main-tab-on{border-bottom-color:${c.accentSeg}!important;background:${c.surfHi}!important;color:${c.segInk}!important}`,
      `.itemx2-tab-inventory:checked~.itemx2-root-layer ${S} label[for="itemx2-tab-inventory"],.itemx2-tab-skills:checked~.itemx2-root-layer ${S} label[for="itemx2-tab-skills"],.itemx2-tab-bestiary:checked~.itemx2-root-layer ${S} label[for="itemx2-tab-bestiary"],.itemx2-tab-settings:checked~.itemx2-root-layer ${S} label[for="itemx2-tab-settings"]{border-bottom-color:${c.accentSeg};background:${c.surfHi};color:${c.segInk}}`,
      `${S} .itemx2-position-choice,${S} .itemx2-font-choice{border-color:${line('.32')};background:${c.input};color:${c.dim4}}`,
      `${S} .itemx2-root-setting-button-primary{border-color:${c.accentSeg};background:${c.raise};color:${c.accentDeep}}`,
      `${S} .itemx2-root-setting-button-busy{color:${c.dim2}}`,
      `${S} .itemx-manager-danger{border-color:#b5646f!important;color:#8f2436!important}`,
      `${S} .itemx2-setting-cleanup-armed{box-shadow:0 0 0 1px #b5646f inset!important}`,
      `${S} .itemx2-tab-loading{color:${c.dim}}`,
      `${S} .itemx-codex-list-button{color:inherit}`,
      `${S} .itemx-empty{color:${c.dim2}}`,
      // Controls and surfaces that hardcode dark values. Without these the light
      // skins show black pills and panels inside an otherwise bright screen.
      `${S} .itemx2-set-group{color:${c.dim2}}`,
      `${S} .itemx2-set-group::after{background:${line('.3')}}`,
      `${S} .itemx2-sw{border-color:${line('.4')}!important;background:${c.input}!important}`,
      `${S} .itemx2-sw>i{background:${c.dim2}}`,
      `${S} .itemx2-sw.itemx-setting-on,${S} .itemx2-sw.itemx2-setting-on{border-color:#5f8f6d!important;background:${c.onSoft}!important}`,
      `${S} .itemx2-sw.itemx-setting-on>i,${S} .itemx2-sw.itemx2-setting-on>i{background:#2f7d5b}`,
      `${S} .itemx2-position-map{border-color:${line('.4')};background:${c.raise}}`,
      `${S} .itemx2-position-screen{color:${c.dim2}}`,
      `${S} .itemx2-position-map .itemx2-position-choice{border-color:${line('.4')};background:${c.input}}`,
      `${S} .itemx2-position-map .itemx2-position-on{border-color:${c.accentSeg};background:${c.accentSeg};box-shadow:0 0 10px color-mix(in srgb,${c.accentSeg} 45%,transparent)}`,
      `${S} .itemx2-position-hint{color:${c.dim}}`,
      `${S} .itemx2-position-hint b{color:${c.ink2}}`,
      `${S} .itemx2-domain-card{border-color:${line('.28')};background:${c.raise};color:${c.body}}`,
      `${S} .itemx2-domain-card>i{color:${c.dim2}}`,
      `${S} .itemx2-domain-card.itemx-setting-on,${S} .itemx2-domain-card.itemx2-setting-on{border-color:#5f8f6d!important;background:${c.onSoft}!important;color:${c.ink3}!important}`,
      `${S} .itemx2-domain-card.itemx-setting-on>i,${S} .itemx2-domain-card.itemx2-setting-on>i{color:#2f7d5b}`,
      `${S} .itemx2-danger-zone{border-color:${c.dangerLine};background:${c.dangerSoft}}`,
      `${S} .itemx2-danger-zone>h4{color:${c.dangerInk}}`,
      `${S} .itemx2-danger-zone .itemx2-root-setting-button{border-color:${c.dangerLine};color:${c.dangerInk}}`,
      // Pre-existing surfaces that the first skin pass missed.
      `${S} .itemx2-manager-row,${S} .itemx2-manager-fold,${S} .itemx2-manager-editor{border-color:${line('.3')};background:${c.raise};color:${c.body}}`,
      `${S} .itemx2-codex-card{border-color:${line('.3')};background:linear-gradient(145deg,${c.tileA},${c.tileB})}`,
      `${S} .itemx2-codex-glyph{border-color:${line('.42')};background:${c.medalA};color:${c.ink3}}`,
      `${S} .itemx2-skill-meta{border-color:${line('.3')};background:${c.raise};color:${c.body}}`,
      `${S} .itemx2-status-chip{border-color:${line('.36')};background:${c.input};color:${c.dim}}`,
      `${S} .itemx2-status-chip-on{border-color:#5f8f6d;background:${c.onSoft};color:#2f7d5b}`,
      `${S} .itemx2-status-chip-off{border-color:${c.dangerLine};background:${c.dangerSoft};color:${c.dangerInk}}`,
      `${S} .itemx2-status-chip-warn{border-color:${c.accentSeg};background:color-mix(in srgb,${c.accentSeg} 12%,transparent);color:${c.accentDeep}}`,
      `${S} .itemx2-mastery i{background:${c.gaugeOff}}`,
      `${S} .itemx2-debug-log,${S} .itemx-debug-log{border-color:${line('.3')};background:${c.raise};color:${c.dim}}`,
      `${S} .itemx2-seg{border-color:${line('.34')};background:${c.seg2}}`,
      `${S} .itemx2-seg-btn{color:${c.dim}}`,
      `${S} .itemx2-seg-on{background:${c.segOn};color:${c.ink2};box-shadow:0 1px 3px rgba(${c.shadowRGB},.18)}`,
      // The toast sits outside the panel but still belongs to the skin. The side badge
      // is an image, so it has nothing to recolour.
      `${S} .itemx2-feedback{border-color:${line('.4')};background:${c.surfHi};color:${c.ink2};box-shadow:0 10px 30px rgba(${c.shadowRGB},.22)}`,
      // Inline chat event chips.
      `${S} .itemx2-inline-event{border-color:${line('.34')};background:linear-gradient(145deg,${c.surfHi},${c.surfLo});color:${c.fg};box-shadow:0 12px 30px rgba(${c.shadowRGB},.18)}`,
      `${S} .itemx2-inline-icon{border-color:${line('.3')};background:radial-gradient(circle at 35% 27%,var(--ix-glow,rgba(${c.glowRGB},.2)),${c.paperHi} 72%)}`,
      `${S} .itemx2-inline-name{color:${c.ink2}}`,
      `${S} .itemx2-inline-meta{color:${c.dim3}}`,
      `${S} .itemx2-inline-state{border-color:${line('.3')};background:rgba(255,255,255,.5)}`
    ].join('');
  }

  const skinStyleSheet = () => SKIN_NAMES.map(skinCss).join('\n');

  const mainStyleText = () =>
    `${ITEMX_MAIN_STYLE}\n${prefixRisuClasses(`${ITEMX_CHAT_STYLE}\n${ITEMX_CODEX_INLINE_STYLE}\n${ITEMX_CODEX_INLINE_DENSE_STYLE}\n${ITEMX_CODEX_INLINE_APPRAISAL_STYLE}\n${rootDrawerStyle()}`)}\n${prefixRisuClasses(ITEMX_CONTROL_STYLE)}\n${bodyScrollStyle}\n${bodyEffectsStyle}\n${prefixRisuClasses(skinStyleSheet())}\n${badgeStyle()}`;

  async function setSkin(character, value) {
    const next = SKIN_MODES.includes(value) ? value : 'dark';
    await writeSetting(character, 'skin', next);
    updateCachedSettings(character, { skin: next });
    await syncMainEffectsState();
  }

  async function syncMainEffectsState() {
    if (!hostState.mainDoc) return;
    try {
      const body = await hostState.mainDoc.querySelector('body');
      if (!body) return;
      if (presentationState.visualEffectsEnabled) await body.removeClass('x-risu-itemx2-effects-off');
      else await body.addClass('x-risu-itemx2-effects-off');
      for (const name of SKIN_NAMES) {
        if (presentationState.visualSkin === name) await body.addClass(`x-risu-itemx2-skin-${name}`);
        else await body.removeClass(`x-risu-itemx2-skin-${name}`);
      }
    } catch (error) {
      debugRecord('effect setting sync', error?.message || String(error));
    }
  }

  async function syncRootFontScale(value) {
    const root = uiState.rootDrawer;
    if (!root) return;
    for (const scale of ['small', 'medium', 'large']) {
      try {
        await root.removeClass(`x-risu-itemx2-font-${scale}`);
      } catch {}
    }
    try {
      await root.addClass(`x-risu-itemx2-font-${['small', 'medium', 'large'].includes(value) ? value : 'small'}`);
    } catch {}
  }

  async function installMainStyle() {
    try {
      if (hostState.mainStyle && workQueue.revision('style-position') === uiState.badgePosition) {
        try {
          if (!(await hostState.mainStyle.getParent())) throw new Error('detached style owner');
          hostState.permissions.mainDom = true;
          hostState.lastDomError = '';
          await installBodyEffectGovernor();
          await syncMainEffectsState();
          await installHostObserver();
          return true;
        } catch {
          hostState.mainStyle = null;
          hostState.mainDoc = null;
          presentationState.bodyFxClassOwner = null;
        }
      }
      const doc = await Risuai.getRootDocument();
      if (!doc) {
        hostState.permissions.mainDom = false;
        hostState.lastDomError = ITEMXText("style.002");
        return false;
      }
      hostState.mainDoc = doc;
      hostState.permissions.mainDom = true;
      const existing = await doc.querySelector('style[x-itemx2-style="owner"]');
      if (existing) {
        hostState.mainStyle = existing;
        await existing.setTextContent(mainStyleText());
        workQueue.remember('style-position', uiState.badgePosition);
        await installBodyEffectGovernor();
        await syncMainEffectsState();
        await installHostObserver();
        return true;
      }
      const style = await doc.createElement('style');
      await style.setAttribute('x-itemx2-style', 'owner');
      await style.setTextContent(mainStyleText());
      const head = await doc.querySelector('head');
      if (head) await head.appendChild(style);
      else await doc.appendChild(style);
      hostState.mainStyle = style;
      workQueue.remember('style-position', uiState.badgePosition);
      hostState.lastDomError = '';
      await installBodyEffectGovernor();
      await syncMainEffectsState();
      await installHostObserver();
      return true;
    } catch (error) {
      hostState.permissions.mainDom = false;
      hostState.mainStyle = null;
      workQueue.remember('style-position', '');
      hostState.mainDoc = null;
      hostState.lastDomError = String(error?.message || error || ITEMXText("style.001"));
      fail('main style connection', error);
      return false;
    }
  }

  function fallbackDocumentHead() { return `<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>${ITEMX_STYLE}${rootDrawerStyle()}${ITEMX_FRAME_STYLE}\n${codexPageStyle()}\n${ITEMX_SETTINGS_STYLE}\n${ITEMX_CONTROL_STYLE}\n${skinStyleSheet()}\nhtml,body{height:100%;min-height:0!important;overflow:hidden;background:transparent!important}.risu-shell{height:100%;min-height:0;background:transparent}.itemx-plugin-stage{width:100%;height:100%;min-height:0;display:block;padding:8px}.itemx-plugin-stage .itemx-panel{width:100%;height:100%;margin:0;max-height:none}.itemx-plugin-stage-fallback{display:flex;align-items:flex-end;justify-content:flex-end;padding:12px;background:transparent}.itemx-plugin-stage-fallback .itemx-panel{width:min(420px,100%);height:min(700px,72dvh);border-radius:16px;box-shadow:0 18px 50px rgba(0,0,0,.58)}.itemx-plugin-panel-in{animation:itemx-plugin-panel-in 190ms cubic-bezier(.2,.78,.2,1) both}.itemx-plugin-panel-out{pointer-events:none;animation:itemx-plugin-panel-out 160ms cubic-bezier(.4,0,1,1) both}@keyframes itemx-plugin-panel-in{from{opacity:0;transform:translate3d(0,7px,0) scale(.982)}to{opacity:1;transform:none}}@keyframes itemx-plugin-panel-out{from{opacity:1;transform:none}to{opacity:0;transform:translate3d(0,5px,0) scale(.988)}}.itemx-search-input{font:inherit;outline:none}.itemx-empty{padding:2rem;text-align:center;color:#77839c}.itemx-disabled{display:grid;gap:12px;padding:28px;color:#93a2ba;overflow:auto}.itemx-disabled strong{color:#f4f0e6}.itemx-disabled .itemx-tool{justify-self:start}.itemx-main-tabs{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));border-bottom:1px solid #171d2b}.itemx-main-tab{min-width:0;min-height:44px;border:0;border-bottom:2px solid transparent;background:#0d121c;color:#77839c;font:inherit;font-size:.72rem;white-space:nowrap;cursor:pointer}.itemx-main-tab-on{border-bottom-color:#d4af6e;color:#f2ead9;font-weight:800}.itemx-panel>.itemx-body{flex:1;min-height:0;overflow:auto}.itemx-settings,.itemx2-iframe-content>.itemx2-root-settings{display:grid;gap:10px;padding:16px;overflow:auto}.itemx-setting-on{border-color:#6baf88;color:#a9e6c2}.itemx-manager{display:grid;gap:10px;padding:14px;border:1px solid #303a4e;border-radius:13px;background:#0b1019}.itemx-manager-title{color:#f0d79d;font-weight:800}.itemx-manager-field{display:grid;gap:5px;color:#8592a8;font-size:.76rem}.itemx-manager-field select,.itemx-manager-field textarea{width:100%;padding:9px;border:1px solid #293448;border-radius:9px;background:#121925;color:#e3e9f3;font:inherit}.itemx-manager-field textarea{min-height:72px;resize:vertical}.itemx-manager-actions{display:grid;grid-template-columns:1fr 1fr;gap:7px}.itemx-manager-danger{border-color:#65333a!important;color:#ffadb5!important}.itemx-manager-current,.itemx-manager-help{color:#718097;font-size:.72rem;line-height:1.45}.itemx-codex-fold{border:1px solid #263247;border-radius:12px;background:#0d121c;overflow:hidden}.itemx-codex-fold summary{display:grid;gap:4px;padding:14px;cursor:pointer;list-style:none}.itemx-codex-fold summary::-webkit-details-marker{display:none}.itemx-codex-fold summary strong{color:#edf2fb}.itemx-codex-fold summary small{color:#8494ad}.itemx-codex-detail{display:grid;gap:7px;padding:11px 14px 14px;border-top:1px solid #202b3c;color:#bdc8d9;font-size:.72rem;line-height:1.5}.itemx-codex-detail b{color:#7788a2}.itemx-debug-log{max-height:180px;overflow:auto;padding:9px;border:1px solid #202b3d;border-radius:8px;background:#080d15;color:#91a2ba;font:10px/1.45 monospace;white-space:pre-wrap}@media(prefers-reduced-motion:reduce){.itemx-plugin-panel-in,.itemx-plugin-panel-out{animation:none!important}}@media(max-width:380px){.itemx-plugin-stage{padding:6px}.itemx-grid{grid-template-columns:1fr}.itemx-manager-actions{grid-template-columns:1fr}}</style>`; }

  const ITEMX_FRAME_STYLE = `.itemx2-frame{position:relative;inset:auto;width:100%;height:100dvh;pointer-events:auto}.itemx2-frame .itemx2-root-layer{position:relative;inset:auto;height:100%}.itemx2-frame .itemx2-root-panel{position:relative;inset:auto!important;transform:none!important;width:100%;height:100%;max-height:100dvh;border-radius:12px}.itemx2-frame .itemx2-native-badge{display:none}`;
