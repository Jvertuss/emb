# Vector

Guides, formula sheets, and original problems for embedded systems
(numbers & memory, GPIO, timers & PWM, and serial communication).

## Run

Open `index.html` directly, or push the folder to GitHub Pages. Every script
is a plain `<script src="...">` tag, so no build step and no `.nojekyll`
workaround is needed (this project doesn't use an underscore-prefixed file).

Hash routes:

- `#/` course map
- `#/concepts` concept index
- `#/concept/atomic-access` one thread across chapters
- `#/ref` formula & data tables
- `#/ch/4/problems` Chapter 4 problems

Files: `index.html` (shell + all CSS), `app.js` (router, views, search,
progress), `widgets.js` (interactive register-bit and PWM widgets),
`reference.js`, `chapters/chNN.js` (content only).

`ch00` is a standalone exam-review chapter (course-specific: MSP430 register
names, TACTL/TASSEL/P1DIR etc.) with 30 fill-in-the-blank/code problems
covering documentation, memory concepts, masking, GPIO, and Timer_A — kept
separate from the generic ch01/02/04/05 chapters, which use vendor-neutral
naming.

## Two rules that are easy to break

1. **Never set `max-width` or `height` on an `svg` inside `.katex`.** KaTeX
   draws `\sqrt` as an svg with `width='400em' height='1.08em'` and
   `preserveAspectRatio='xMinYMin slice'`. Overriding either attribute
   collapses the radical hook and leaves a bare overline. Any responsive svg
   rule must be scoped to direct children (see `.guide-body figure>svg`).
2. **Keep the stash step in `mdMath()`.** Math (`$...$`, `$$...$$`) and widget
   placeholders (`[[widget:type|k=v]]`) are pulled out of the source string
   before `marked.parse()` runs and put back after, so markdown can't mangle
   LaTeX and marked doesn't wrap widget markup in stray `<p>` tags it can't
   parse correctly.
3. **Double every LaTeX backslash inside a chapter string.** Write `\\dfrac`,
   not `\dfrac`. JavaScript reads `\f` as a form feed and silently drops the
   backslash on plenty of other letters; the file still looks correct in an
   editor, and the damage only appears once the browser parses the string.

## Check before committing

There's no bundled KaTeX in this environment to run the check headlessly;
before committing a chapter, open the page and confirm no math renders as a
raw `$...$` string or throws in the console. If Node + a local `katex`
install are available, the original project's check adapts directly:

```
node -e "const k=require('katex');global.registerChapter=c=>{const w=(o)=>{
 if(typeof o==='string'){(o.match(/\$\$[\s\S]*?\$\$|\$[^\$\n]+?\$/g)||[])
 .forEach(m=>{try{k.renderToString(m.replace(/^\$+|\$+$/g,''),{throwOnError:true})}
 catch(e){console.log('BAD:',m.slice(0,60))}})}
 else if(o&&typeof o==='object')Object.values(o).forEach(w)};w(c)};
 global.registerReference=()=>{};require('./chapters/ch04.js')"
```

Silence means every expression in that file parses.

`COURSE_ORDER` and `CONCEPTS` at the top of `app.js` drive navigation. Adding
a chapter file is enough to make it appear, provided its `id` is also listed
in `COURSE_ORDER` — an id left out of a chapter file (like `ch03` here)
renders as a dimmed, unclickable "pending" row instead of disappearing.

## Authoring

Copy the shape of any existing `chapters/chNN.js` file and add a matching
`<script>` tag in `index.html`, then list its id in `COURSE_ORDER` in
`app.js`. Inside template literals, double every LaTeX backslash.

Use `[[widget:registerBits|title=...|hint=...]]` or `[[widget:pwm|title=...]]`
on its own line to embed an interactive widget, and `[[concept:some-id]]`
inline to link to a concept thread defined in `CONCEPTS`.

## Widgets

Two widget types ship in `widgets.js`, in the same two-pane / readout-strip /
note shell as the rest of the site:

- **`registerBits`** — eight clickable bits form a byte; a second pane mirrors
  them as GPIO pin states, with live binary/hex/decimal readouts.
- **`pwm`** — frequency and duty-cycle sliders draw a live pulse train and
  report period, on-time, off-time, and duty.

## Figures

There are no hand-drawn schematic figures in this initial content set — the
`svg.nx-schematic` styling rules are kept in `index.html` for any future
`<figure class="nx-frame"><svg class="nx-fig">` diagrams, themed the same way
the original project themes them: strokes use `currentColor`, fills use
`var(--panel)`, so light/dark both work without per-figure edits.
