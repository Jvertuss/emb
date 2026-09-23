registerChapter({
  id: "ch01",
  title: "Numbers, Memory & the Register Model",
  brief: [
    "Every peripheral on a microcontroller — a GPIO pin, a timer, a UART — is, from the CPU's point of view, just a handful of bytes sitting at a fixed memory address. Learning to read those bytes as bits, and those addresses as hardware, is the whole trick of embedded programming.",
    "This chapter builds the vocabulary the rest of the course leans on: binary and hex as two views of the same number, the memory map as the address book of the chip, and why a naive update to a shared register can silently lose data.",
  ],
  sections: [
    {
      id: "01.1",
      name: "Binary, hex & bit math",
      items: [
        {
          id: "why-bits",
          title: "Why hardware speaks in bits",
          body: `A wire is either near 0V or near the supply voltage — there's no clean way to represent "7" on a single wire, only "on" or "off". A microcontroller gives you eight, sixteen, or thirty-two of these wires bundled into one number, and every one of those bits is independently meaningful: bit 3 might be one GPIO pin, bit 4 a completely different one.

Binary is the literal truth of the hardware. Hex is binary written in a form a person can actually read: each hex digit stands for exactly four bits, so $\\text{0xA5}$ is $\\text{1010 0101}$ with zero mental arithmetic once the mapping is memorized ($\\text{A}=1010$, $\\text{5}=0101$). Decimal, by contrast, doesn't line up with bit boundaries at all — $165$ tells you nothing about which pins are high. That's why register dumps, datasheets, and debuggers default to hex.

**Two's complement**, briefly: a signed 8-bit value flips its top bit to mean "subtract 128" instead of "add 128". $\\text{0xFF}$ is $255$ unsigned but $-1$ signed, because $128+64+32+16+8+4+2+1=255$, and $255 - 256 = -1$. The bit pattern never changes — only how you've agreed to read it.`,
        },
        {
          id: "bit-idioms",
          title: "Set, clear, toggle, test",
          body: `Four operations cover almost everything you'll ever do to a register, and all four leave every bit alone except the one you name:

- **Set** bit $n$: $R \\mathrel{|}= (1 \\ll n)$ — OR-ing with a single 1 forces that position high and cannot turn anything else off.
- **Clear** bit $n$: $R \\mathrel{\\&}= \\sim(1 \\ll n)$ — AND-ing with everything-but-that-bit forces it low without touching the rest.
- **Toggle** bit $n$: $R \\mathrel{\\wedge}= (1 \\ll n)$ — XOR flips exactly the named bit.
- **Test** bit $n$: $(R \\gg n) \\mathrel{\\&} 1$ — shift the bit of interest down to position 0, then mask everything else away.

$1 \\ll n$ is doing the real work in all four: it's a single 1 bit walked $n$ places left, i.e. the value $2^n$. Everything else is just "how do I apply that mask."`,
        },
        {
          id: "register-widget-item",
          title: "Reading a register as pins, not a number",
          body: `The whole idea of a bit as an independent switch is easiest to believe by flipping bits yourself. The register below behaves like an 8-pin GPIO output register: click a bit on the left, and the corresponding pin lights on the right.

[[widget:registerBits|title=8-bit output register|hint=GPIO_ODR]]

Notice that $\\text{0xAA}$ (alternating $\\text{1010 1010}$) and $\\text{0x55}$ (alternating $\\text{0101 0101}$) are bit-for-bit inverses — a classic test pattern precisely because every pin differs from its neighbor, which makes wiring mistakes on a logic analyzer obvious at a glance.`,
        },
      ],
    },
    {
      id: "01.2",
      name: "The memory map",
      items: [
        {
          id: "memory-mapped-io",
          title: "Memory-mapped I/O: registers ARE addresses",
          body: `On most microcontrollers there is no separate instruction for "talk to a peripheral" — a peripheral register is just a location in the same address space as RAM, and you read or write it exactly like you'd read or write a variable. A datasheet entry like

$$\\text{GPIOA\\_ODR} = \\text{0x4001080C}$$

means: the output data register for port A lives at that literal address. In C, that's usually spelled as a pointer:

\`\`\`
#define GPIOA_ODR (*(volatile unsigned int *)0x4001080C)
GPIOA_ODR |= (1 << 5);   // drive pin PA5 high, leave every other pin alone
\`\`\`

This is why embedded C leans so heavily on pointers and bit math: there is no abstraction between "I want pin 5 high" and "I want bit 5 of the word at this address set." The datasheet's register map is the entire API.`,
        },
        {
          id: "volatile-truth",
          title: "Volatile: telling the compiler the truth",
          body: `An optimizing compiler assumes memory doesn't change unless *your code* changes it — a completely safe assumption for ordinary variables, and a dangerous one for a hardware register that a peripheral, an interrupt, or a human pressing a button can change on its own.

Without \`volatile\`, a compiler is free to read a status register once, cache the value in a CPU register, and reuse that stale copy in a loop like \`while (STATUS_REG & READY_BIT) {}\` — turning a wait-for-hardware loop into an infinite loop, or a loop that exits before the hardware is actually ready. \`volatile\` tells the compiler: re-read this from memory every single time, no caching, no reordering, no assuming.

It is worth being precise about what \`volatile\` does **not** do: it doesn't make an operation atomic, and it doesn't add any synchronization between an ISR and \`main()\`. It only stops the compiler from optimizing the memory access away.`,
        },
        {
          id: "race-condition",
          title: "Why a read-modify-write isn't one operation",
          body: `\`R |= (1 << 3);\` reads as a single line of C, but the CPU sees three separate steps: **load** the current value of \`R\`, **compute** the OR, **store** the result back. Anything that runs between the load and the store — most commonly an interrupt service routine — is invisible to this sequence, and if that other code also modifies \`R\`, its change gets silently overwritten the moment the store happens.

Concretely: \`main()\` loads \`R = 0x00\`, an ISR fires and sets bit 5 so the real value in memory becomes \`0x20\`, \`main()\` resumes with its *stale* copy of \`0x00\`, ORs in bit 3 to get \`0x08\`, and stores that — erasing the ISR's update. Nothing crashed, no error was raised; a pin the ISR meant to leave high is now low, and the bug only shows up as an intermittent, timing-dependent glitch. This exact hazard is the [[concept:atomic-access]] thread running through the rest of the course — timers and buffers hit the same three-step problem from different angles.`,
        },
      ],
    },
  ],
  problems: [
    {
      id: "ch01-p1",
      tags: ["warmup"],
      body: "Convert the 8-bit binary value $\\text{1011 0010}$ to hex and to unsigned decimal.",
      hint: "Split into two 4-bit nibbles — $\\text{1011}$ and $\\text{0010}$ — and convert each nibble to one hex digit.",
      solution: "$\\text{1011}=\\text{B}$ and $\\text{0010}=\\text{2}$, so the value is $\\text{0xB2}$. In decimal: $128+16+32+2=178$.",
    },
    {
      id: "ch01-p2",
      tags: ["warmup"],
      body: "What single hex byte, written to an 8-bit register, sets bits 0, 3, and 5 and clears every other bit?",
      hint: "Bit $n$ contributes $2^n$ to the value. Add the contributions of the three bits you want set.",
      solution: "$2^0+2^3+2^5 = 1+8+32 = 41 = \\text{0x29}$.",
    },
    {
      id: "ch01-p3",
      tags: ["core"],
      body: "A 16-bit register lives at address `0x40010800`. Write one C statement that sets bit 7 of that register without disturbing any other bit, given `#define REG (*(volatile unsigned short *)0x40010800)`.",
      hint: "You want the set idiom from this chapter, applied to `REG`.",
      solution: "`REG |= (1 << 7);` — OR-ing with a single 1 in position 7 forces that bit high and leaves every other bit exactly as it was.",
      expert: "If this register happens to sit in a Cortex-M bit-band alias region, the same effect can be had with a single atomic store to a bit-band address instead of a read-modify-write — closing the race window in [[concept:atomic-access]] entirely, at the cost of a much larger (but simpler) address computation per bit.",
    },
    {
      id: "ch01-p4",
      tags: ["core"],
      body: "Explain, in terms of load/compute/store, why `flags |= (1 << 2);` in `main()` is not safe if an ISR can also modify `flags` at any time — even though the C source looks like one atomic line.",
      hint: "Where exactly could an interrupt land, and what would `main()`'s next step do with the value it already loaded?",
      solution: "The compiler translates the line into (1) load `flags` into a CPU register, (2) OR in the bit 2 mask, (3) store the result back to `flags`. If an interrupt fires between steps 1 and 3 and modifies `flags` in memory, `main()`'s step 3 overwrites that change with its own stale-plus-modified copy, silently discarding whatever the ISR wrote.",
    },
    {
      id: "ch01-p5",
      tags: ["challenge"],
      body: "Two pieces of code — `main()` and an ISR — both execute `port |= (1 << 4);` on the same 8-bit register, starting from `port = 0x00`. Describe a specific instruction-level interleaving of their load/compute/store steps that leaves `port` equal to `0x10` even though, intuitively, setting the same already-agreed bit twice should be harmless — then explain why this particular case is actually *not* a bug, and construct a second interleaving (with two *different* bits) that does lose data.",
      hint: "Setting the same bit from both sides can't go wrong, because OR-ing a 1 into a position that will end up 1 either way is idempotent. The dangerous case needs two different target bits.",
      solution: "Same-bit case: whatever interleaving occurs, both sides compute `... | 0x10`, so `port` ends at `0x10` regardless of ordering — no data is lost because the two writes agree. Losing case: let the ISR set bit 4 while `main()` sets bit 5. If `main()` loads `port=0x00`, the ISR then runs to completion (load `0x00`, OR to `0x10`, store `0x10`), and `main()` resumes with its stale `port=0x00`, ORs in bit 5 to get `0x20`, and stores `0x20` — the ISR's bit 4 is gone, even though both operations individually looked correct.",
      expert: "This is exactly why hardware vendors add \"set/clear\" register pairs (e.g. a BSRR-style register with separate set-bits and clear-bits halves) for GPIO: writing to BSRR is a single store with no read step at all, so there is no load/compute/store window for an interrupt to land in, regardless of which bits either side touches.",
    },
  ],
});
