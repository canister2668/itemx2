# CSS parity check

Compares the computed styles of every element (and its `::before`/`::after`)
of a sample page — chat cards inside `.chattext`, the drawer in every tab and
skin — under two versions of the host-document stylesheet, at two widths.

    mkdir -p /tmp/parity
    node --import ./tests/helpers/register.mjs tools/css-parity/samples.mjs /tmp/parity   # body.html + css.txt
    # produce the other stylesheet the same way from the other revision, then:
    npm i --no-save playwright-core
    node tools/css-parity/compare.mjs /tmp/parity/body.html old-css.txt /tmp/parity/css.txt

Used in 2.4 to show that dropping the `.chattext`-scoped duplicate sheet and
de-duplicating rules changed no computed style (0 differences, 8,184 nodes).
