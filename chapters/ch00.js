registerChapter({
  id: "ch00",
  title: "Exam Review: MSP430 Fundamentals",
  brief: [
    "This chapter is scoped to EEL 4742C's exam coverage: everything through Labs 1–3, up to (but not including) interrupts. It's a condensed pass over dev-board & documentation basics, memory concepts, bit masking, GPIO, and Timer_A — the two heaviest-weighted topics being masking and Timer_A, since both show up as fill-in-the-blank code on the exam.",
    "Work the guide once, then go straight to the 30 practice problems below and grade yourself against the solutions. If a problem takes more than a minute to start, that's the section to re-read.",
  ],
  sections: [
    {
      id: "00.1",
      name: "Dev board, documentation & environment",
      items: [
        {
          id: "three-docs",
          title: "Three documents, three jobs",
          body: `Every TI part comes with three documents, and knowing which one answers which question is itself an exam-tested skill:

- **LaunchPad board's user's guide** — board-specific wiring: which pin an LED or button sits on, whether it's active-high or active-low, the board's schematic.
- **Chip's data sheet** — chip-specific lookup facts: FLASH/RAM size, pin count, how many timer instances *this particular chip* has, electrical characteristics (what voltage would damage it), clock accuracy.
- **Family user's guide** (a.k.a. Technical Reference Manual) — how the peripherals work in general, shared across every chip in the family. This is where you learn *how Timer_A works*, and where each chapter ends with the register bit-layouts you actually program against.

A quick way to keep them straight: board guide = "where," data sheet = "how much/how many," family guide = "how."`,
        },
        {
          id: "naming-form",
          title: "Chip naming & form factor",
          body: `\`MSP430FR6989\`: **MSP** = Mixed Signal Processor, **FR** = FRAM (ferroelectric nonvolatile RAM) — versus plain **F** or **G** for Flash. The leading digit of the number (\`6\`989) names the series — this chip is in the **FR6xx** family; the Basic LaunchPad's \`MSP430G2553\` is in the **x2xx** family (leading \`2\`).

Form factors (how the same die gets packaged): **DIP/PDIP** (two rows of through-hole pins), **TSOP** (thin, small, hard to hand-solder), **QFN** (no leads, soldered flat to the board). The data sheet says which packages a given chip ships in.`,
        },
        {
          id: "toolchain-jtag",
          title: "Toolchain & JTAG",
          body: `The "compiler" is really a pipeline: **preprocessor → compiler → assembler → linker**, producing an executable that gets flashed to the MCU. The linker's configuration file encodes the memory map — it's what puts code in FLASH and ordinary variables in RAM.

**JTAG** is the on-chip hardware module used for programming and debugging in-circuit. Standard JTAG uses 4 wires; MSP430's 2-wire version is **Spy-Bi-Wire (SBW)** — fewer pins, slower. JTAG is a real security hole (anyone who can tap those pins can dump or modify code/data in debug mode), which is why chips have a **security fuse** that permanently disables JTAG after programming is finished. The **FET** (Flash Emulation Tool) sits between the PC's USB port and the MCU's JTAG/BSL pins — PCs don't speak JTAG natively, so the FET translates. In debug mode, the code runs **under the debugger's supervision**, not independently; that's the whole distinction between debug mode and normal mode.`,
        },
      ],
    },
    {
      id: "00.2",
      name: "Memory concepts",
      items: [
        {
          id: "addressing-capacity",
          title: "Address width ↔ capacity",
          body: `Byte-addressable memory: every address names one byte. An $n$-bit address gives $2^n$ unique addresses, i.e. $2^n$ bytes of capacity. The reverse question — "smallest address width for a given capacity" — just means: round the capacity up to the next power of two and take its exponent. $14\\text{ KB}$ needs a 14-bit address ($2^{14}=16\\text{ KB}$, the smallest power of two at or above 14 KB); a size that isn't already a power of two rounds *up*, never down.`,
        },
        {
          id: "alignment-endian",
          title: "Alignment and endianness",
          body: `**Alignment** means a value sits at an address divisible by its own size: a byte is always aligned (anywhere), a 16-bit value must sit at an even address, a 32-bit value at a multiple of 4. A 32-bit value dropped at a random address lands aligned only 1 time in 4 (25%). When variables of mixed size are packed in declared order, padding bytes get inserted before a wider variable to push it onto an aligned address — that padding is often exactly what an exam question is testing you to notice.

**Endianness** is about byte order, not bit order: **little endian** (MSP430's choice) stores the least-significant byte at the lowest address; **big endian** stores the most-significant byte at the lowest address. $\\text{0x12CD}$ at address 400–401 is \`CD 12\` little-endian, \`12 CD\` big-endian.`,
        },
        {
          id: "mmio",
          title: "Memory-mapped I/O",
          body: `A peripheral register isn't a separate address space — it's just a byte (or word) at a fixed memory address, read/written with ordinary load/store instructions. \`P1OUT\` (writing Port 1's pins) and \`P1IN\` (reading them) are each mapped to a specific address; in C, that mapping is invisible because the toolchain's header file already declares \`P1OUT\`/\`P1IN\` as \`volatile\` variables pinned to those addresses — you just use the name.`,
        },
      ],
    },
    {
      id: "00.3",
      name: "Masking operations",
      items: [
        {
          id: "single-bit-idioms",
          title: "Set, clear, invert, check — one bit",
          body: `Four idioms, using \`BITx\` constants from the device header:

\`\`\`
data |= BIT3;              // set bit 3
data &= ~BIT3;             // clear bit 3
data ^= BIT3;              // invert bit 3
if ((data & BIT3) != 0) …  // check if bit 3 is 1  (or: == BIT3)
if ((data & BIT3) == 0) …  // check if bit 3 is 0
\`\`\`

OR forces a bit high without touching others; AND-with-complement forces it low without touching others; XOR flips it; AND-then-compare reads it. The same four idioms apply verbatim to *several* bits at once by OR-ing the masks together, e.g. \`data |= BIT4|BIT5;\`.`,
        },
        {
          id: "bit-fields",
          title: "Bit fields inside one register",
          body: `A single register often packs several named fields (Timer_A's \`TACTL\` is the running example: \`TASSELx\`, \`IDx\`, \`MCx\`, plus single-bit \`TACLR\`/\`TAIE\`/\`TAIFG\`). The header defines one constant per field-value, like \`TASSEL_2\`, \`ID_3\`, \`MC_1\` — each already shifted into the right bit position.

**Setting several fields at once** (safe only when you don't care about the register's current contents): just OR them together — \`TACTL = TASSEL_2 | ID_3 | MC_1 | TACLR;\`.

**Changing one field without disturbing the others** (the current value of that field is unknown) needs two steps — clear the whole field, then OR in the new value:
\`\`\`
TACTL &= ~MC_3;   // clear the entire MC field (MC_3 = both MC bits set)
TACTL |= MC_1;    // set MC to 1 (up mode)
\`\`\`
This clear-then-set pattern is the single most exam-relevant idiom in the whole course — it's exactly how you change one Timer_A setting mid-program.`,
        },
      ],
    },
    {
      id: "00.4",
      name: "GPIO programming",
      items: [
        {
          id: "pin-config",
          title: "Configuring a pin",
          body: `Four Port-1 registers (substitute the port number for other ports): \`P1DIR\` (0=input,1=output), \`P1OUT\` (drives the pin when output; selects pull-up/pull-down when input+REN), \`P1IN\` (reads the pin, input only), \`P1REN\` (enables the internal pull resistor).

\`\`\`
// LED on P1.3: just configure as output
P1DIR |= BIT3;

// Button on P1.5, active low, no external resistor on the PCB
P1DIR &= ~BIT5;   // input
P1REN |= BIT5;    // enable internal resistor
P1OUT |= BIT5;    // select pull-up
\`\`\`
Whether a circuit is active-high or active-low is a *wiring* fact you read off the schematic, not something the register config tells you — but once you know it, "check if pushed" is just "check if the bit reads the active level."`,
        },
        {
          id: "wait-until",
          title: "Wait-until barriers",
          body: `A blocking "wait until some condition" is a \`while\` loop whose condition is the **inverse** of what you're waiting for — the loop body is empty, and it exits the instant the real condition becomes true:
\`\`\`
while ( /* condition NOT YET true */ ) {}
\`\`\`
For multi-button conditions (e.g. "wait until S1 pushed AND S2 released," both active-low on Port 1), it helps to build the truth table for the two bits, mark the target row, and then write the \`!=\` against everything that isn't the target — that's a much safer method under time pressure than trying to guess the boolean expression directly.`,
        },
        {
          id: "button-flag-wdt",
          title: "Button flags & software reset",
          body: `\`P1IFG\` latches: a bit rises to 1 when its pin transitions and **stays 1** until manually cleared, even though these are technically "interrupt" flags — you can poll and clear them without ever enabling interrupts. This is how you catch a button press that happened while you were busy elsewhere (e.g. inside a software delay loop).

The watchdog timer is stopped with a password-protected write: \`WDTCTL = WDTPW | WDTHOLD;\`. Writing to \`WDTCTL\` **without** the password is not an error — it deliberately resets the MCU, which is a legitimate way to force a software reset from a button press.`,
        },
      ],
    },
    {
      id: "00.5",
      name: "Timer_A",
      items: [
        {
          id: "tactl-fields",
          title: "TACTL, field by field",
          body: `\`TACTL\` packs: **TASSELx** (clock source: 0 TACLK, 1 ACLK, 2 SMCLK, 3 inverted TACLK), **IDx** (input divider: 0 ÷1, 1 ÷2, 2 ÷4, 3 ÷8), **MCx** (mode: 0 stop, 1 up, 2 continuous, 3 up/down), plus **TACLR** (clears the counter and divider on write), **TAIE**, **TAIFG**. \`TAR\` is the 16-bit counter itself, range 0–65535.`,
        },
        {
          id: "modes",
          title: "Continuous mode vs. up mode",
          body: `**Continuous mode** counts $0, 1, 2, \\ldots, 65535, 0, 1, \\ldots$ — \`TAIFG\` is raised on the rollover *back to* zero, **not** at the initial zero. Period $= 65536$ cycles at whatever the post-divider clock rate is.

**Up mode** counts $0, 1, \\ldots, \\text{TACCR0}, 0, 1, \\ldots$ — \`CCIFG\` fires when \`TAR\` hits \`TACCR0\`, \`TAIFG\` fires on the rollover back to zero. Period $= (\\text{TACCR0}+1)$ cycles, since zero itself counts as one tick.`,
        },
        {
          id: "period-math",
          title: "Going from a target time to register values",
          body: `The general recipe: $\\text{cycles} = \\text{time} \\times \\text{effective clock}$, where the effective clock is the source frequency divided by the ID setting. If the resulting cycle count doesn't fit in 16 bits (65535 max), increase the divider — and if even the largest divider (÷8) isn't enough for a long delay, fall back to the two-stage trick: pick an ID that gives a *short*, clean sub-period in up mode, then count that sub-period N times in software (a simple incrementing counter checked against N) to reach the full target duration.`,
        },
      ],
    },
    {
      id: "00.6",
      name: "Clock sources & C extras",
      items: [
        {
          id: "oscillators",
          title: "Crystal vs. RC oscillator",
          body: `Two ways to generate a clock, and the exam likes asking you to compare them head to head:

- **Startup speed** — a crystal is *slow* to start (mechanical resonance takes time to stabilize, often milliseconds); an RC oscillator starts almost instantly.
- **Accuracy** — a crystal is very accurate (tight, well-specified frequency); an RC oscillator is comparatively imprecise.
- **Stability over temperature/voltage** — a crystal is stable across temperature and supply swings; an RC oscillator drifts noticeably with both.
- **Price** — a crystal costs more (it's a separate component with its own footprint); an RC oscillator is essentially free, since it's just resistors/capacitors already on the die.

MSP430's internal **VLO** (~12 kHz) is an RC-type oscillator — fast to start, imprecise, and exactly why it's fine for a rough delay but not for anything timing-critical like UART baud generation.`,
        },
        {
          id: "c-extensions",
          title: "Why embedded C needs extensions",
          body: `Standard C has no vocabulary for "disable interrupts" or "put the CPU to sleep" — those are hardware actions with no equivalent in portable C semantics. Compiler vendors add **extensions**: intrinsic functions and keywords that map directly onto a specific instruction. The downside is exactly what you'd expect: code using vendor extensions is no longer portable to a different compiler or a different CPU architecture without rewriting those calls.

An **intrinsic function** looks like an ordinary function call but the compiler recognizes it specially and emits one (or a few) exact machine instructions in its place — no real function call, no return address pushed, just a direct translation. \`_enable_interrupts()\` and \`_disable_interrupts()\` are intrinsics, not real function calls.

Why call \`_enable_interrupts()\` instead of writing \`SR |= GIE;\` by hand? Because the intrinsic is guaranteed to compile to the exact single instruction the CPU architecture requires for that action (often with placement/ordering guarantees the compiler otherwise wouldn't promise around a plain memory-mapped write) — hand-rolling the bit-set can be reordered or optimized by the compiler in ways a raw status-register write doesn't protect against.`,
        },
        {
          id: "fixed-width-types",
          title: "Fixed-width types & delay-loop pitfalls",
          body: `Plain \`int\` in C has no guaranteed width — it's whatever's natural for the target CPU (16-bit on classic MSP430, 32-bit on many others), which is exactly why embedded code prefers explicit types like \`uint8_t\`/\`int16_t\`/\`uint32_t\`: the register you're mapping onto has a known, fixed width, and portable code shouldn't silently change size when it's recompiled for a different core.

A classic software delay-loop bug: doubling the loop's upper bound doesn't reliably double the delay if an optimizing compiler notices the loop variable is never used for anything and removes the "useless" loop entirely (or the loop was never \`volatile\`-protected) — the fix is the same \`volatile\` discipline from Chapter 1, not a bigger number. If a delay loop that should clearly take time appears to take **no** time at all at run time, the first suspect is exactly this: the compiler optimized the empty loop away.`,
        },
      ],
    },
  ],
  problems: [
    // ---- Memory concepts ----
    {
      id: "ch00-p1", tags: ["warmup", "memory"],
      body: "A memory is byte-addressable with a 12-bit address, all addresses valid. What is its capacity?",
      hint: "Capacity $= 2^{\\text{address width}}$ bytes.",
      solution: "$2^{12} = 4096$ bytes (4 KB).",
    },
    {
      id: "ch00-p2", tags: ["warmup", "memory"],
      body: "A memory has a capacity of 33 KB. What is the smallest address width (in bits) that can address it?",
      hint: "Round 33 KB up to the next power of two, then take the exponent.",
      solution: "The next power of two at or above 33 KB is $64\\text{ KB} = 2^{16}$, so **16 bits**.",
    },
    {
      id: "ch00-p3", tags: ["core", "memory"],
      body: `Variables below must be stored in declared order, aligned, starting at address 500:
\`\`\`
char a;   // 8-bit
int b;    // 32-bit
short c;  // 16-bit
char d;   // 8-bit
\`\`\`
Give the address of each variable (mark any padding bytes).`,
      hint: "500 isn't a multiple of 4 — how many pad bytes does `b` need before it can land aligned?",
      solution: "`a`: 500. Padding: 501–503 (3 bytes, so `b` lands on a multiple of 4). `b`: 504–507. `c`: 508–509 (already even, no padding needed). `d`: 510.",
    },
    {
      id: "ch00-p4", tags: ["warmup", "memory"],
      body: "Fill in the blanks: MSP430 uses ______ endian, meaning the ______ significant byte is stored at the ______ address.",
      hint: "MSP430's endianness was stated explicitly in the memory-concepts slides.",
      solution: "**little** endian; the **least** significant byte is stored at the **lowest** address.",
    },
    {
      id: "ch00-p5", tags: ["core", "memory"],
      body: `An LED is memory-mapped to address \`0x0210\`. Fill in the blank to turn it on (assembly-style, as in the memory-concepts slide):
\`\`\`
Store word <value>, <______>
\`\`\`
What is the equivalent action in C, given \`volatile unsigned int LED_REG;\` pinned to that address?`,
      hint: "The assembly blank just needs the address operand; the C version is a plain assignment.",
      solution: "Assembly: `Store word <value>, <&0x0210>`. C: `LED_REG = value;` — memory-mapped I/O means an ordinary store/assignment *is* the hardware access.",
    },

    // ---- Masking operations ----
    {
      id: "ch00-p6", tags: ["warmup", "masking"],
      body: `Fill in the code to set, clear, and invert bit 5 of \`uint8_t data\`, using \`BIT5\`:
\`\`\`
data ______ ______;   // set
data ______ ______;   // clear
data ______ ______;   // invert
\`\`\`
`,
      hint: "Set = OR, clear = AND-with-complement, invert = XOR.",
      solution: "`data |= BIT5;`  ·  `data &= ~BIT5;`  ·  `data ^= BIT5;`",
    },
    {
      id: "ch00-p7", tags: ["warmup", "masking"],
      body: "Fill in the code to set bits 2 and 6 together, and to clear bits 2 and 6 together.",
      hint: "OR the two masks together for the set case; complement the OR of the two masks for the clear case.",
      solution: "`data |= BIT2|BIT6;`  ·  `data &= ~(BIT2|BIT6);`",
    },
    {
      id: "ch00-p8", tags: ["core", "masking"],
      body: "Write one `if` line each that checks: (a) bit 4 is 1, (b) bit 4 is 0, (c) bits 1 and 4 are both 1.",
      hint: "For (c), OR the two bit masks together before comparing to the same OR'd value.",
      solution: `(a) \`if ((data & BIT4) != 0) ...\` (equivalently \`== BIT4\`)
(b) \`if ((data & BIT4) == 0) ...\`
(c) \`if ((data & (BIT1|BIT4)) == (BIT1|BIT4)) ...\``,
    },
    {
      id: "ch00-p9", tags: ["core", "masking"],
      body: "A register `CFG` has fields `MODEx` (2-bit), `RATEx` (3-bit), `EN` (1-bit), with the usual `FIELD_value` symbolic constants pre-shifted into place. Write one line that sets `MODE=2`, `RATE=5`, `EN=1` in a single assignment.",
      hint: "This is safe as a single `=` only because you're defining every field of the register at once.",
      solution: "`CFG = MODE_2 | RATE_5 | EN;`",
    },
    {
      id: "ch00-p10", tags: ["challenge", "masking"],
      body: "For the same `CFG` register, write two lines that change only `RATE` to 6, leaving `MODE` and `EN` unknown/unchanged.",
      hint: "Clear the whole RATE field first — what constant represents \"every bit of the RATE field set to 1\"?",
      solution: "`CFG &= ~RATE_7;` (clears the full 3-bit field, since `RATE_7` = all field bits set) followed by `CFG |= RATE_6;`",
    },

    // ---- GPIO ----
    {
      id: "ch00-p11", tags: ["warmup", "gpio"],
      body: "Fill in the blank to configure P2.4 as an output: `P2DIR ______ ______;`",
      hint: "Direction bit 1 = output.",
      solution: "`P2DIR |= BIT4;`",
    },
    {
      id: "ch00-p12", tags: ["core", "gpio"],
      body: "Fill in the blanks to configure P2.5 as an input with an internal pull-up enabled (no external resistor on the PCB): `P2DIR`, `P2REN`, `P2OUT`.",
      hint: "Three registers, three separate bits to set/clear on the same pin.",
      solution: "`P2DIR &= ~BIT5;`  ·  `P2REN |= BIT5;`  ·  `P2OUT |= BIT5;` (pull-up)",
    },
    {
      id: "ch00-p13", tags: ["warmup", "gpio"],
      body: "An LED on P2.4 is active low and already configured as output. Write the lines to turn it on, turn it off, and toggle it.",
      hint: "Active low means \"on\" is a 0 on the pin.",
      solution: "`P2OUT &= ~BIT4;` (on) · `P2OUT |= BIT4;` (off) · `P2OUT ^= BIT4;` (toggle, works regardless of polarity)",
    },
    {
      id: "ch00-p14", tags: ["warmup", "gpio"],
      body: "A button on P2.5 is active high. Write an `if` condition that is true when the button is pushed.",
      hint: "Active high means the pin reads 1 when pushed.",
      solution: "`if ((P2IN & BIT5) != 0) ...`",
    },
    {
      id: "ch00-p15", tags: ["core", "gpio"],
      body: "Fill in the blank so the code blocks until button S1 (active low, `BIT6` of Port 1) is pushed: `while ( ______ ) {}`",
      hint: "The while-condition is the inverse of \"S1 is pushed.\"",
      solution: "`while ((P1IN & BIT6) != 0) {}` — loop continues as long as the pin is still at its released (1) level.",
    },
    {
      id: "ch00-p16", tags: ["challenge", "gpio"],
      body: "Using `#define S1 BIT6` and `#define S2 BIT7` (both active low, Port 1), write a `while` condition that blocks until **both** S1 and S2 are pushed at the same time.",
      hint: "Build the 2-bit truth table for (S1,S2) and mark the one row that's the target; the loop condition is everything else.",
      solution: "`while ((P1IN & (S1|S2)) != 0) {}` — both pushed means both bits read 0, so the OR'd read is exactly 0 only in the target case; the loop keeps spinning for every other combination.",
    },

    // ---- Timer_A ----
    {
      id: "ch00-p17", tags: ["warmup", "timer"],
      body: "Fill in the `TACTL` field values for: source = SMCLK, divider = ÷4, mode = continuous, and clear the timer: `TACTL = TASSEL_ | ID_ | MC_ | TACLR;`",
      hint: "SMCLK is source #2; ÷4 is divider setting #2; continuous is mode #2.",
      solution: "`TACTL = TASSEL_2 | ID_2 | MC_2 | TACLR;`",
    },
    {
      id: "ch00-p18", tags: ["core", "timer"],
      body: "Using continuous mode with SMCLK at 1 MHz and `ID=1` (÷2), what is the timer's period in seconds?",
      hint: "Effective clock $=$ 1 MHz $/$ 2. Continuous mode always counts the full 65,536 ticks.",
      solution: "$t_{tick} = 1/(1\\text{MHz}/2) = 2\\ \\mu s$. Period $= 65536 \\times 2\\ \\mu s = 0.131$ s.",
    },
    {
      id: "ch00-p19", tags: ["core", "timer"],
      body: "Using SMCLK at 1 MHz, you want a period of exactly 0.25 seconds in **up mode**. Fill in a working `ID` and `TACCR0`: `TACCR0 = ___; TACTL = TASSEL_2 | ID_ | MC_1 | TACLR;`",
      hint: "$0.25\\text{s}\\times1\\text{MHz}=250{,}000$ cycles — too big for 16 bits raw, so a divider is required first.",
      solution: "With `ID_2` (÷4): $250{,}000/4=62{,}500$ cycles, so `TACCR0 = 62499` (since up mode's period is TACCR0+1). `TACTL = TASSEL_2 | ID_2 | MC_1 | TACLR;`",
    },
    {
      id: "ch00-p20", tags: ["warmup", "timer"],
      body: "Fill in the blanks to poll the up-mode compare flag and clear it: `while ( (______ & ______) == 0 ) {} ` then clear it.",
      hint: "Up mode's compare event flag lives in the channel's control register, not `TACTL` itself.",
      solution: "`while ((TACCTL0 & CCIFG) == 0) {}` then `TACCTL0 &= ~CCIFG;`",
    },
    {
      id: "ch00-p21", tags: ["challenge", "timer"],
      body: "SMCLK is 1 MHz. You need a 3.2-second delay, but `TAR` only holds 16 bits. Describe the two-part strategy from class and give one valid (ID, TACCR0, repeat-count) combination.",
      hint: "Divide the clock down, pick a short clean sub-period in up mode, then count that sub-period N times in software.",
      solution: "Divide by 8 (`ID_3`) → effective clock 125,000 Hz. Use `TACCR0 = 49999` for a 0.4 s sub-period ($50{,}000$ cycles $/125{,}000\\text{Hz}=0.4$s). Repeat that sub-period **8** times in a software counter to reach $8\\times0.4\\text{s}=3.2$s.",
    },
    {
      id: "ch00-p22", tags: ["core", "timer"],
      body: "ACLK is fed by a 12 kHz VLO. You want the effective timer clock to become exactly 3,000 Hz using the input divider. What `ID` value achieves this?",
      hint: "$12{,}000 / \\text{divider} = 3{,}000$ — solve for the divider, then match it to an `ID` setting.",
      solution: "$12{,}000/4=3{,}000$, so divide by 4 → **`ID_2`**.",
    },
    {
      id: "ch00-p23", tags: ["warmup", "timer"],
      body: "In up mode, `TACCR0 = 24999`. What is the timer's period, in cycles?",
      hint: "Up mode counts zero as its own tick.",
      solution: "$24999+1=25{,}000$ cycles.",
    },
    {
      id: "ch00-p24", tags: ["core", "timer"],
      body: "True/False, and correct the false ones: (a) `TAIFG` is raised the instant `TACLR` clears the timer to zero. (b) In up mode, `CCIFG` is raised when `TAR` reaches `TACCR0`. (c) Continuous mode counts from 0 up to `TACCR0` and repeats.",
      hint: "Two of these three describe the wrong mode or the wrong moment.",
      solution: "(a) **False** — `TAIFG` fires on the rollover *back to* zero, not at an explicit clear. (b) **True.** (c) **False** — that's up mode's behavior; continuous mode counts all the way to 65,535.",
    },

    // ---- Docs / environment ----
    {
      id: "ch00-p25", tags: ["warmup", "docs"],
      body: "Fill in the blank: to stop the watchdog timer at the start of `main()`: `WDTCTL = ______ | ______;`",
      hint: "One part is the required password.",
      solution: "`WDTCTL = WDTPW | WDTHOLD;`",
    },
    {
      id: "ch00-p26", tags: ["core", "docs"],
      body: `Match each question to the correct document (LaunchPad board's user's guide / chip's data sheet / family user's guide):
(a) "How does the SPI peripheral work in general?"
(b) "How many timer instances does this specific chip have?"
(c) "Which pin is button S2 wired to, and is it active high or low?"`,
      hint: "Board wiring, chip-specific counts, and general peripheral behavior each live in a different one of the three.",
      solution: "(a) family user's guide — (b) chip's data sheet — (c) LaunchPad board's user's guide.",
    },
    {
      id: "ch00-p27", tags: ["warmup", "docs"],
      body: "List, in order, the four stages of the \"compiler\" pipeline described in class.",
      hint: "Textual substitution comes first, machine code comes last.",
      solution: "Preprocessor → Compiler → Assembler → Linker.",
    },
    {
      id: "ch00-p28", tags: ["warmup", "docs"],
      body: "Fill in the blank: standard JTAG uses ______ wires; the reduced 2-wire version used on MSP430 is called ______.",
      hint: "The 2-wire name is an initialism ending in \"Wire.\"",
      solution: "**4** wires; **Spy-Bi-Wire (SBW)**.",
    },
    {
      id: "ch00-p29", tags: ["warmup", "docs"],
      body: "True/False: in debug mode, the code on an MSP430 LaunchPad runs completely independently of the PC.",
      hint: "What role does the debugger play while a breakpoint or single-step is active?",
      solution: "**False** — in debug mode the code runs under the supervision of the debugger; the PC software and on-chip JTAG hardware work together.",
    },
    {
      id: "ch00-p30", tags: ["challenge", "docs"],
      body: "Fill in the blank with the correct chip-naming interpretation: `MSP430FR6989` — \"FR\" indicates ______ memory, and the leading digit \"6\" of \"6989\" indicates the chip belongs to the ______ series.",
      hint: "Contrast FR against plain F or G, and compare the leading digit to the Basic LaunchPad's G2553.",
      solution: "\"FR\" = **FRAM** (ferroelectric nonvolatile RAM); the leading \"6\" places it in the **FR6xx** series.",
    },

    // ---- Timer_A: multi-answer calculation drills ----
    {
      id: "ch00-p31", tags: ["core", "timer"],
      body: "Timer_A runs from a 300 kHz clock in **continuous mode**. Give the timer's period for every value of `ID` (0 through 3).",
      hint: "Continuous mode is always 65,536 ticks; only the tick length changes with `ID`.",
      solution: `Effective clock and period for each divider:
| ID | Effective clock | Period |
|---|---|---|
| 0 (÷1) | 300 kHz | 65536/300000 ≈ **0.2185 s** |
| 1 (÷2) | 150 kHz | ≈ **0.4369 s** |
| 2 (÷4) | 75 kHz | ≈ **0.8738 s** |
| 3 (÷8) | 37.5 kHz | ≈ **1.7476 s** |`,
    },
    {
      id: "ch00-p32", tags: ["challenge", "timer"],
      body: "Same 300 kHz clock, **up mode**, target period of exactly 0.5 s. Find every valid (`ID`, `TACCR0`) pair (cycle counts must be whole numbers and fit in 16 bits).",
      hint: "cycles $= 0.5\\text{s} \\times \\text{effective clock}$; check which dividers give a whole number under 65536.",
      solution: `$0.5\\text{s}\\times300{,}000=150{,}000$ cycles at ÷1 — too big for 16 bits. Divide down:
| ID | Effective clock | Cycles needed | Fits in 16 bits? | TACCR0 |
|---|---|---|---|---|
| 0 (÷1) | 300 kHz | 150,000 | No | — |
| 1 (÷2) | 150 kHz | 75,000 | No | — |
| 2 (÷4) | 75 kHz | 37,500 | Yes | 37499 |
| 3 (÷8) | 37.5 kHz | 18,750 | Yes | 18749 |
Two valid solutions: \`ID_2\` with \`TACCR0=37499\`, or \`ID_3\` with \`TACCR0=18749\`.`,
    },
    {
      id: "ch00-p33", tags: ["core", "timer"],
      body: "ACLK is fed by a 16,384 Hz crystal. In **continuous mode**, give the timer's period for every value of `ID`.",
      hint: "Same method as p31, just a different source frequency.",
      solution: `| ID | Effective clock | Period |
|---|---|---|
| 0 (÷1) | 16,384 Hz | 65536/16384 = **4 s** |
| 1 (÷2) | 8,192 Hz | **8 s** |
| 2 (÷4) | 4,096 Hz | **16 s** |
| 3 (÷8) | 2,048 Hz | **32 s** |
(16,384 Hz is $2^{14}$, which is exactly why every one of these comes out to a clean power-of-two number of seconds.)`,
    },
    {
      id: "ch00-p34", tags: ["challenge", "timer"],
      body: "SMCLK is 5 MHz. Can Timer_A be configured, using only `TASSEL`/`ID`/`MC`/`TACCR0` (up mode), to *directly* produce a 0.5 s delay? Show the analysis and state your conclusion.",
      hint: "Compute the cycles needed at every available divider and check each against the 16-bit ceiling.",
      solution: `Cycles needed $=0.5\\text{s}\\times5{,}000{,}000=2{,}500{,}000$ at ÷1. Dividing by the largest available factor of 8 only gets to $2{,}500{,}000/8=312{,}500$ cycles — still far above 65,535. **Conclusion: no**, a single up-mode period cannot directly reach 0.5 s at 5 MHz with only the built-in ÷1…÷8 divider; the two-stage software-counter trick (short sub-period × N repeats) is required instead.`,
    },

    // ---- Clocks & C extras ----
    {
      id: "ch00-p35", tags: ["core", "clocks"],
      body: "Compare a crystal oscillator and an RC oscillator on: startup speed, accuracy, stability with temperature/voltage, and price.",
      hint: "One of the two wins on every axis except one.",
      solution: "**Startup:** crystal is slow, RC is fast. **Accuracy:** crystal is accurate, RC is comparatively imprecise. **Stability (temp/voltage):** crystal is stable, RC drifts more. **Price:** crystal costs more (separate component), RC is essentially free (on-die).",
    },
    {
      id: "ch00-p36", tags: ["warmup", "clocks"],
      body: "Why does embedded programming rely on compiler-specific 'extensions' to standard C? What's the downside?",
      hint: "Think of an action standard C has literally no syntax for.",
      solution: "Standard C has no built-in way to express hardware-only actions like disabling interrupts or entering a low-power mode, so compiler vendors add extensions (intrinsics, special keywords) to reach them. The downside: code that uses those extensions is no longer portable to a different compiler or CPU without being rewritten.",
    },
    {
      id: "ch00-p37", tags: ["warmup", "clocks"],
      body: "What is an intrinsic function?",
      hint: "It looks like a function call in the source — what does the compiler actually do with it?",
      solution: "A function-call-looking construct that the compiler recognizes specially and translates directly into one (or a few) exact machine instructions, rather than generating a real function call — no call/return overhead, and it can guarantee the precise instruction the hardware needs.",
    },
    {
      id: "ch00-p38", tags: ["core", "clocks"],
      body: "MSP430 enables/disables interrupts by writing the `GIE` bit in the status register. Why use `_enable_interrupts()`/`_disable_interrupts()` instead of writing `SR |= GIE;` directly?",
      hint: "What extra guarantee does an intrinsic give you that a plain register write doesn't?",
      solution: "These are intrinsic functions that compile to the exact single instruction the architecture requires for that action, with guarantees around ordering/placement that the compiler doesn't otherwise promise for a hand-written bit-set on a status register — a manual `SR |= GIE;` can be reordered or optimized in ways that break the timing-sensitive intent.",
    },
    {
      id: "ch00-p39", tags: ["warmup", "clocks"],
      body: "How many bits is a plain `int` in C, and why does embedded code prefer types like `uint8_t`/`int16_t` instead?",
      hint: "Is `int`'s width guaranteed by the C standard, or just \"whatever's natural\" for the target?",
      solution: "`int`'s width isn't fixed by the standard — it's whatever's natural for the compiler/CPU (commonly 16-bit on classic MSP430, 32-bit elsewhere). Fixed-width types guarantee an exact, known size regardless of target, which matters when a variable has to match a register's exact width.",
    },
    {
      id: "ch00-p40", tags: ["challenge", "clocks"],
      body: "A software delay loop counts `unsigned int counter` from 0 to 45,000 to create a short delay. If you double the upper bound to 90,000, are you guaranteed double the delay?",
      hint: "What is an optimizing compiler allowed to do with a loop whose variable is never read by anything?",
      solution: "No. If the loop body does nothing with `counter` besides incrementing it, an optimizing compiler is free to conclude the loop has no observable effect and delete it entirely (or drastically shorten it) — in which case doubling the bound changes nothing at run time. The loop only reliably delays if the compiler is prevented from optimizing it away (e.g. a `volatile` counter, or a compiler flag that disables that optimization).",
    },
    {
      id: "ch00-p41", tags: ["core", "clocks"],
      body: "A program contains a delay loop, but at run time no delay is observed at all. What should you suspect first during debugging?",
      hint: "This follows directly from the previous problem.",
      solution: "That the compiler optimized the \"useless\" empty loop away entirely — check whether the loop variable is `volatile` and whether the loop has any real side effect the compiler can't prove away.",
    },

    // ---- Full timer code, VLO-based (Homework practice style) ----
    {
      id: "ch00-p42", tags: ["challenge", "timer"],
      body: `ACLK is sourced from the 12 kHz VLO. Using **continuous mode**, adjust the effective clock to 6,000 Hz with the input divider, and toggle the red LED (\`P1.0\`, active high) every time the timer rolls over. Fill in the configuration and the polling loop.
\`\`\`
TACTL = TASSEL_ | ID_ | MC_ | TACLR;
P1DIR |= BIT0;
while(1) {
  while ( (______ & ______) == 0 ) {}
  P1OUT ______ BIT0;
  TACTL &= ~______;
}
\`\`\`
What is the resulting toggle period?`,
      hint: "12,000 Hz ÷ 2 = 6,000 Hz — which `ID` gives ÷2? ACLK is source #1.",
      solution: `\`\`\`
TACTL = TASSEL_1 | ID_1 | MC_2 | TACLR;
P1DIR |= BIT0;
while(1) {
  while ( (TACTL & TAIFG) == 0 ) {}
  P1OUT ^= BIT0;
  TACTL &= ~TAIFG;
}
\`\`\`
Period $= 65536/6000 \\approx 10.92$ s between toggles (continuous mode always counts the full 65,536 ticks).`,
    },
    {
      id: "ch00-p43", tags: ["challenge", "timer"],
      body: `Same 12 kHz VLO on ACLK, but now use **up mode**: adjust the effective clock to 3,000 Hz, and generate a 0.5 s delay before toggling \`P1.0\` (active high). Fill in \`TACCR0\` and the configuration.`,
      hint: "12,000 ÷ 4 = 3,000 Hz. At 3,000 Hz, how many cycles is 0.5 s?",
      solution: `$0.5\\text{s}\\times3{,}000\\text{Hz}=1{,}500$ cycles, so \`TACCR0 = 1499\`.
\`\`\`
TACCR0 = 1499;
TACTL = TASSEL_1 | ID_2 | MC_1 | TACLR;
P1DIR |= BIT0;
while(1) {
  while ( (TACCTL0 & CCIFG) == 0 ) {}
  P1OUT ^= BIT0;
  TACCTL0 &= ~CCIFG;
}
\`\`\``,
    },
    {
      id: "ch00-p44", tags: ["challenge", "timer"],
      body: "SMCLK is ~1 MHz. Generate a 4-second delay: first divide the clock by 8, then use up mode for a 0.4 s sub-period, then count ten of those sub-periods before flashing the red LED (`P1.0`, active high). Write the full configuration and loop.",
      hint: "1 MHz ÷ 8 = 125,000 Hz. How many cycles is 0.4 s at that rate?",
      solution: `$0.4\\text{s}\\times125{,}000\\text{Hz}=50{,}000$ cycles → \`TACCR0=49999\`.
\`\`\`
#define LED BIT0
unsigned int counter = 0;

TACCR0 = 49999;
TACTL = TASSEL_2 | ID_3 | MC_1 | TACLR;
P1DIR |= LED;

while(1) {
  while ( (TACCTL0 & CCIFG) == 0 ) {}
  TACCTL0 &= ~CCIFG;
  counter = (counter + 1) % 10;
  if (counter == 0)
    P1OUT ^= LED;   // fires once every 10 x 0.4s = 4 seconds
}
\`\`\``,
    },
    {
      id: "ch00-p45", tags: ["core", "clocks"],
      body: `On the Basic LaunchPad (G2553), ACLK defaults to a crystal, not the VLO. Fill in the three register lines (from the practice handout) that redirect ACLK to the 12 kHz VLO instead:
\`\`\`
BCSCTL1 ______ ______;   // clear XTS
BCSCTL3 ______ ______;   // clear LFXT1S
BCSCTL3 ______ ______;   // set LFXT1S = 2 (VLO)
\`\`\``,
      hint: "The first two lines clear bits/fields; the third sets a specific field value.",
      solution: `\`\`\`
BCSCTL1 &= ~XTS;
BCSCTL3 &= ~LFXT1S_3;
BCSCTL3 |= LFXT1S_2;
\`\`\``,
    },

    // ---- More code-writing: masking & bit fields ----
    {
      id: "ch00-p46", tags: ["warmup", "masking"],
      body: "Write code that sets bit 4 **and** clears bit 5 of `uint8_t data`, as two independent statements.",
      hint: "Set and clear are still separate idioms even when done back to back on the same variable.",
      solution: `\`\`\`
data |= BIT4;
data &= ~BIT5;
\`\`\``,
    },
    {
      id: "ch00-p47", tags: ["core", "masking"],
      body: `A control register \`CTL\` packs the fields \`SLP\` (2-bit, bits 7-6), \`CLK\` (3-bit, bits 5-3), \`CAP\` (2-bit, bits 2-1), \`IE\` (1-bit, bit 0), with the usual pre-shifted \`FIELD_value\` constants supplied. Write one line that configures: \`SLP=1\`, \`CLK=5\`, \`CAP=2\`, \`IE=1\`.`,
      hint: "Every field is being defined at once, so a single OR-assignment is safe here.",
      solution: "`CTL = SLP_1 | CLK_5 | CAP_2 | IE;`",
    },
    {
      id: "ch00-p48", tags: ["core", "masking"],
      body: "For the configuration in the previous problem, show each field's mask in binary and the final 8-bit value of `CTL`.",
      hint: "Line the four masks up vertically and OR them by column.",
      solution: `\`\`\`
SLP_1: 0100 0000
CLK_5: 0010 1000
CAP_2: 0000 0100
IE:    0000 0001
       =========
CTL:   0110 1101
\`\`\``,
    },
    {
      id: "ch00-p49", tags: ["challenge", "masking"],
      body: "Write code that changes `SLP` to 2, leaving `CLK`/`CAP`/`IE` at whatever they currently are (unknown).",
      hint: "Clear the entire 2-bit `SLP` field first — what constant represents both `SLP` bits set to 1?",
      solution: `\`\`\`
CTL &= ~SLP_3;   // clear the full SLP field (SLP_3 = both bits set)
CTL |= SLP_2;
\`\`\``,
    },
    {
      id: "ch00-p50", tags: ["challenge", "masking"],
      body: "Write code that changes `CLK` to 6, leaving `SLP`/`CAP`/`IE` unknown/unchanged.",
      hint: "Same clear-then-set pattern, applied to the 3-bit `CLK` field.",
      solution: `\`\`\`
CTL &= ~CLK_7;   // clear the full CLK field (CLK_7 = all 3 bits set)
CTL |= CLK_6;
\`\`\``,
    },
    {
      id: "ch00-p51", tags: ["warmup", "masking"],
      body: "Write an `if` condition that checks whether `SLP` is currently 2.",
      hint: "Mask out everything except the SLP field, then compare to the field's own \"value=2\" constant.",
      solution: "`if ((CTL & SLP_3) == SLP_2) ...`",
    },
    {
      id: "ch00-p52", tags: ["warmup", "masking"],
      body: "Write an `if` condition that checks whether `CLK` is currently 6.",
      hint: "Same pattern as the previous problem, over the CLK field.",
      solution: "`if ((CTL & CLK_7) == CLK_6) ...`",
    },
    {
      id: "ch00-p53", tags: ["challenge", "masking"],
      body: "Write an `if` condition that checks whether `CLK` is currently one of {0, 2, 4, 6} — i.e. any even value — in a single comparison, without listing all four values.",
      hint: "Every even value in a 3-bit field shares one thing in common at the least-significant bit of that field. What single-bit mask isolates just that bit?",
      solution: "Every even 3-bit value has its low bit (bit 3 of `CTL`, the LSB of the CLK field) equal to 0, so: `if ((CTL & CLK_1) == 0) ...` (where `CLK_1` is the mask for just that one field-bit). This is the same \"test one bit of a field\" trick used for checking a field is in {4,5,6,7} by testing only its top bit.",
    },

    // ---- Memory: address-range sizing ----
    {
      id: "ch00-p54", tags: ["core", "memory"],
      body: "A microcontroller's memory map allocates FLASH code space to the address range `[0x0500, 0x0CFF]`. What code size, in bytes, does this support?",
      hint: "Size = (end address − start address) + 1, since both ends are inclusive.",
      solution: "$\\text{0x0CFF} - \\text{0x0500} + 1 = \\text{0x0800} = 2048$ bytes (2 KB).",
    },
    {
      id: "ch00-p55", tags: ["core", "memory"],
      body: "A device's vector table occupies the 16-bit address range `[0xFFC0, 0xFFFF]`. If each vector is one 16-bit address wide, how many vectors does the table support?",
      hint: "Total bytes in the range, divided by bytes per vector.",
      solution: "$\\text{0xFFFF}-\\text{0xFFC0}+1=\\text{0x0040}=64$ bytes; each vector is 2 bytes, so $64/2=\\textbf{32}$ vectors.",
    },

    // ---- GPIO: fuller code-writing ----
    {
      id: "ch00-p56", tags: ["challenge", "gpio"],
      body: `Translate this pseudocode (from class) into real C. \`S1\` is on \`P1.6\` (active low), \`LED1\` is on \`P1.4\` (active high), both already configured.
Goal: if \`S1\` is pushed and held for longer than the loop can count to 50,000, toggle \`LED1\`.
\`\`\`
if(button is pushed) {
  counter = 0;
  while(1) {
    if(button is released) break;
    counter++;
    if(counter > 50000) { toggle LED1; break; }
  }
}
\`\`\``,
      hint: "\"Pushed\"/\"released\" on an active-low pin are the same idioms from the GPIO chapter — just wire them into the given control flow.",
      solution: `\`\`\`
#define S1   BIT6
#define LED1 BIT4
unsigned long counter;

if ((P1IN & S1) == 0) {            // S1 pushed
  counter = 0;
  while (1) {
    if ((P1IN & S1) != 0) break;   // S1 released -> give up
    counter++;
    if (counter > 50000) {
      P1OUT ^= LED1;
      break;
    }
  }
}
\`\`\``,
    },
    {
      id: "ch00-p57", tags: ["core", "gpio"],
      body: "Using `#define S1 BIT6` and `#define S2 BIT7` (both Port 1, active low), write a `while` condition that blocks until **at least one** of S1 or S2 is pushed (an OR condition, not the AND version from earlier).",
      hint: "\"Neither pushed\" means both bits still read 1 — the loop should keep spinning only in that one case.",
      solution: "`while ((P1IN & (S1|S2)) == (S1|S2)) {}` — the loop only continues while *both* bits are still at their released (1) level; it exits the moment either one goes low.",
    },

    // ---- Timer_A: capture & multi-output synthesis ----
    {
      id: "ch00-p58", tags: ["challenge", "timer"],
      body: "Timer_A channel 0 is in capture mode, running in continuous mode, and captures `TACCR0 = 10000` on the button-push edge and `TACCR0 = 800` on the release edge. `TAR` is known to have rolled over exactly once between the two captures. What was the actual button-press duration, in cycles?",
      hint: "The counter went from 10000 up to 65535, wrapped to 0, then continued up to 800 — add both legs together.",
      solution: "$(65536-10000) + 800 = 56{,}336$ cycles. (If you instead compute a plain $800-10000$ you get a negative number — that's the signal that a rollover happened and needs to be accounted for.)",
    },
    {
      id: "ch00-p59", tags: ["challenge", "timer"],
      body: `Two GPIO outputs (\`P1.0\` = Signal 1, \`P1.1\` = Signal 2) must never be high at the same time. Period = 1000 cycles, each signal's duty is 200/1000: Signal 1 high during cycles [500,700), Signal 2 high during cycles [0,200). Using **up mode** (\`TACCR0=999\`) and polling \`TAR\` directly in the main loop (no separate compare channels, since that's beyond what's been taught), write code that drives both outputs correctly.`,
      hint: "Read `TAR` every loop iteration and turn each pin on/off based on which numeric range it currently falls in.",
      solution: `\`\`\`
#define SIG1 BIT0
#define SIG2 BIT1
unsigned int t;

TACTL = TASSEL_2 | ID_0 | MC_1 | TACLR;   // up mode, period 1000

while (1) {
  t = TAR;
  if (t >= 500 && t < 700) P1OUT |= SIG1; else P1OUT &= ~SIG1;
  if (t < 200)             P1OUT |= SIG2; else P1OUT &= ~SIG2;
}
\`\`\`
The two ranges [500,700) and [0,200) never overlap, which is exactly what keeps the two signals from ever being high together — that non-overlap is the actual design constraint, not anything about the timer mode.`,
    },
    {
      id: "ch00-p60", tags: ["challenge", "timer"],
      body: `Extend the class clock-update example (\`second\`/\`minute\`/\`hour\` with 12-hour \`ampm\`) to instead keep 24-hour time — no \`ampm\` variable, and \`hour\` rolls from 23 back to 0. Write the modified rollover logic (assume \`second++\` already happened this tick).`,
      hint: "Only the innermost rollover (the hour check) needs to change; minute and second rollover stay identical.",
      solution: `\`\`\`
if (second == 60) {
  second = 0;
  minute++;
  if (minute == 60) {
    minute = 0;
    hour++;
    if (hour == 24) {
      hour = 0;
    }
  }
}
\`\`\`
Dropping the 12-hour \`ampm\` toggle collapses the two nested checks (\`hour==12\` and \`hour==13\`) from the original into one: roll over at 24 straight back to 0.`,
    },
  ],
});
