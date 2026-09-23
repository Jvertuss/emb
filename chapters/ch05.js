registerChapter({
  id: "ch05",
  title: "Serial Communication",
  brief: [
    "UART, SPI, and I2C move bytes between chips one bit at a time over one to four wires, and each protocol trades wire count for either a shared clock or a shared agreement about timing. Get that agreement wrong — a mismatched baud rate, a clock in the wrong mode — and every byte arrives corrupted even though the wiring itself is perfect.",
    "This chapter builds UART framing and baud rate from first principles, then places SPI and I2C alongside it so their trade-offs — speed, wire count, addressing, topology — are visible side by side.",
  ],
  sections: [
    {
      id: "05.1",
      name: "UART: agreeing on time without a shared clock",
      items: [
        {
          id: "uart-framing",
          title: "The frame: start bit, data bits, stop bit",
          body: `UART has no dedicated clock wire — both sides simply agree in advance on how many bits per second to expect, called the **baud rate**, and each side counts its own time independently. That only works because every byte is wrapped in a **frame**: the line idles high, a **start bit** (a forced transition to low) tells the receiver "a byte begins now, reset your timing," then 8 data bits follow at the agreed rate, then a **stop bit** returns the line high before the next frame can begin.

That start bit is doing more work than it looks like: it's the *only* moment the two sides resynchronize. Everything from there until the stop bit is the receiver trusting its own clock to still be right, which is why UART is often described in terms of [[concept:bit-timing]] — the whole scheme is a bet that neither side's clock drifts enough within one 10-bit frame to matter.

The common shorthand "8N1" names the three configurable pieces: 8 data bits, No parity bit, 1 stop bit. Parity, when used, is a single extra bit that lets the receiver detect (not correct) a single flipped bit in the frame.`,
        },
        {
          id: "baud-mismatch",
          title: "How much baud mismatch a frame can survive",
          body: `If the receiver's clock runs even slightly faster or slower than the sender's, it starts sampling each subsequent bit a little earlier or later within that bit's time slot, and the error accumulates bit by bit across the frame. Because the start bit resynchronizes timing at the beginning of *every* frame, the only drift that matters is what accumulates over one frame's worth of bits — commonly cited tolerance for standard UART is roughly $\\pm 2$–$3\\%$ before the last data bit or the stop bit is sampled at the wrong moment and the byte is misread or a framing error is flagged.

This is also why 9600, 19200, 38400, and 115200 aren't arbitrary numbers — they're chosen so that common oscillator frequencies divide into them with very small rounding error. A baud rate that isn't a clean divisor of the clock can silently introduce exactly this kind of drift even with correct code on both ends.`,
        },
      ],
    },
    {
      id: "05.2",
      name: "SPI and I2C",
      items: [
        {
          id: "spi-basics",
          title: "SPI: a shared clock instead of a shared guess",
          body: `SPI adds a dedicated clock line (SCLK) that the master drives, so unlike UART, the receiving side never has to *guess* the timing — it samples exactly when the clock edge tells it to. That's the whole reason SPI can run so much faster than UART: there's no drift budget to spend, because there's nothing to synchronize independently.

The trade-off is wire count and addressing: a basic SPI bus needs a shared clock (SCLK) and data lines (MOSI, MISO), plus one dedicated **chip-select** (CS) line *per device*, since SPI has no built-in addressing scheme — the master picks which device is listening by asserting that device's CS line low and no others.`,
        },
        {
          id: "i2c-basics",
          title: "I2C: two wires, many devices, addresses instead of chip-selects",
          body: `I2C solves the same "many devices, one master" problem SPI solves with per-device CS lines, but with only two shared wires total: SDA (data) and SCL (clock), both open-drain with pull-up resistors — the same open-drain idea from Chapter 2, which is exactly why disagreeing devices don't fight each other on the bus. Instead of a chip-select, every device listens to every transaction and only responds if the first byte on the bus matches its own 7- (or 10-) bit address.

The cost of trading wires for addressing is speed: because both lines are shared, open-drain, and pulled up rather than driven, I2C tops out well below SPI's typical range — commonly 100 kHz ("standard mode") up to a few MHz in its fastest variants, versus tens of megahertz for SPI.`,
        },
      ],
    },
    {
      id: "05.3",
      name: "Buffering serial data",
      items: [
        {
          id: "buffer-race",
          title: "The ring buffer's head and tail",
          body: `A UART receive interrupt typically pushes each incoming byte into a **ring buffer** — a fixed-size array with a \`head\` index (where the ISR writes next) and a \`tail\` index (where \`main()\` reads next). This is the same [[concept:atomic-access]] hazard from Chapter 1, wearing different clothes: \`head\` is written only by the ISR, \`tail\` only by \`main()\`, but the *count of bytes waiting* is usually computed as \`head - tail\`, read by both sides.

If that count spans more than a single-instruction read on the target CPU — the same multi-byte read problem from Chapter 4's millisecond counter — \`main()\` can compute a buffer count using a \`head\` value from before the ISR's latest update and a \`tail\` from after its own last read, producing a count that briefly implies more or fewer bytes are waiting than actually are. The usual fix is the same as before: keep the critical section (the part that reads both indices together) short and interrupt-safe, and prefer buffer sizes that are powers of two so the wraparound math is a fast, single-instruction bitmask rather than a comparison and branch.`,
        },
      ],
    },
  ],
  problems: [
    {
      id: "ch05-p1",
      tags: ["warmup"],
      body: "At 19200 baud, how long does one bit take, and how long does a full 8N1 frame (10 bits total: start + 8 data + stop) take?",
      hint: "Bit time is $\\dfrac{1}{\\text{baud}}$; the frame is 10 bit times.",
      solution: "Bit time $= \\dfrac{1}{19200} \\approx 52.1\\ \\mu s$. Frame time $= 10 \\times 52.1\\ \\mu s \\approx 521\\ \\mu s$.",
    },
    {
      id: "ch05-p2",
      tags: ["warmup"],
      body: "Why does SPI not need a baud rate agreement between master and slave the way UART does?",
      hint: "What tells the receiving side exactly when to sample each bit?",
      solution: "SPI has a dedicated clock line (SCLK) driven by the master, so the slave samples data on clock edges it directly receives rather than on timing it has to estimate on its own — there is nothing to \"agree on in advance\" because the clock itself is shared in real time.",
    },
    {
      id: "ch05-p3",
      tags: ["core"],
      body: "A design needs to talk to six identical sensor chips that only support SPI, and the microcontroller is short on free GPIO pins. Would switching these sensors to I2C variants (if available) help with the pin shortage, and why?",
      hint: "Count the wires each protocol needs as the number of devices grows.",
      solution: "Yes. SPI needs one dedicated chip-select pin *per device* in addition to the three shared lines, so six SPI sensors cost $3+6=9$ pins. I2C's SDA and SCL are shared by every device on the bus regardless of count, so six I2C sensors (each with a distinct address) cost only 2 pins total — the saving grows directly with the number of devices.",
    },
    {
      id: "ch05-p4",
      tags: ["core"],
      body: "A receiver's clock runs 4% faster than the sender's. Explain, bit by bit, why the start bit still arrives fine but a later data bit in the same frame is more likely to be misread — without doing the full drift-budget arithmetic.",
      hint: "The start bit is the resynchronization point. What has had time to accumulate by, say, data bit 7?",
      solution: "The start bit only has to be detected as \"the line went low\" — there's no accumulated timing error yet, since the receiver just reset its sampling clock to it. But each subsequent bit is sampled at a time computed by adding one more bit-period to the receiver's own (slightly fast) clock, so the sampling instant drifts a little further from the true center of each bit as the frame goes on; by the last data bit or the stop bit, that accumulated drift is largest and most likely to land outside the correct bit's time window.",
    },
    {
      id: "ch05-p5",
      tags: ["challenge"],
      body: "A ring buffer's \"bytes available\" count is computed as `count = head - tail;` where both are `volatile uint8_t` and the buffer size is 256 (so 8-bit wraparound is intentional and correct on its own). `main()` reads this count, and separately, a UART ISR increments `head` each time a byte arrives. Argue that — unlike the 16-bit millisecond counter from Chapter 4 — this particular design is actually safe from the torn-read hazard, and identify the one design choice responsible.",
      hint: "How many bytes wide is `head`, and how many load instructions does reading it take on almost any target?",
      solution: "Because `head` and `tail` are each a single byte (`uint8_t`), reading either one is a single-instruction load on essentially any microcontroller — there's no multi-byte read for an interrupt to land in the middle of, so there's no torn value possible for either index individually. The subtraction `head - tail` in `main()` might use a slightly stale `head` if the ISR fires between the two reads, but the result is simply the count *as of a moment ago*, not an internally inconsistent value like the 16-bit case — at worst `main()` under-counts by the bytes that arrived during the subtraction, which it will simply see on the next check. The responsible design choice is keeping both indices to a single byte, which is also exactly why 256-entry (or other power-of-two, byte-indexable) ring buffers are the conventional default.",
      expert: "This is a narrow safety margin, not a general license to ignore atomicity: the moment either index needs to be wider than the CPU's natural word size — a 65536-entry buffer on an 8-bit core, for instance — the exact torn-read hazard from Chapter 4 returns, register-map convenience or not.",
    },
  ],
});
