# Numberblocks Generator `.sb3` structure

Source file: [`public/assets/Numberblocks Generator.sb3`](../public/assets/Numberblocks%20Generator.sb3)

Runtime loader / current mapper: [`src/lib/numberblocksSb3.ts`](../src/lib/numberblocksSb3.ts)

This document is a reference dump of the Scratch project tree so we can map integers → the correct costumes consistently (including “figured-out” characters and large named blocks).

Generated from `project.json` inside the `.sb3` (Scratch 3.0 / semver 3.0.0 / vm 15.0.2-revert-react-context-menu-static-init.1).

## Archive layout

An `.sb3` is a ZIP:

```
Numberblocks Generator.sb3
├── project.json          # targets, costumes, sounds, scripts, variables
├── <md5>.svg            # vector costumes (~1369)
├── <md5>.png            # bitmap costumes (~26)
└── <md5>.wav            # sounds (~164)
```

Costume / sound entries in `project.json` point at ZIP members via `md5ext` (e.g. `849f937f….svg`).
Several costumes may share one physical asset.

## Target namespace tree

Scratch sprite names use `Group//Sprite` as a fake folder. There are **131** targets.

```
Stage
Thumbnail
Galaxy
Max
Min
NBs//                     # Numberblock body sprites (place-value + modes)
Digits//                  # On-screen digit / power / multiplier UI glyphs
assets//                  # Named character packs + editor sheets
Menu//                    # Generator UI controls
```

### Full target tree (with costume / sound counts)

#### `(root)`

| Target | Costumes | Sounds | Blocks | Notes |
| --- | ---: | ---: | ---: | --- |
| `Galaxy` | 18 | 1 | 70 | plain `nN`: 1–17 (16); other: antisizelimit, antisizelimit2 |
| `Max` | 1 | 1 | 9 | other: costume1 |
| `Min` | 1 | 1 | 9 | other: costume1 |
| `Stage` | 32 | 163 | 822 | 32 non-`nN` costumes |
| `Thumbnail` | 8 | 1 | 6 | 8 non-`nN` costumes |

#### `NBs//`

| Target | Costumes | Sounds | Blocks | Notes |
| --- | ---: | ---: | ---: | --- |
| `Billions` | 143 | 1 | 40 | plain `nN`: 0–99 (100); 43 `*-fof` |
| `Exp 100` | 13 | 1 | 126 | plain `nN`: 0–8 (7); other: n1-normal, n1-square, n4-normal, n4-square, n9-normal, n9-square |
| `Exp Ones/Tens` | 160 | 1 | 155 | plain `nN`: 0–99 (84); 43 `*-fof`; 33 non-`nN` costumes |
| `Exp Smol10+1` | 160 | 1 | 109 | plain `nN`: 0–99 (84); 43 `*-fof`; 33 non-`nN` costumes |
| `Exp Smol100` | 13 | 1 | 59 | plain `nN`: 0–8 (7); other: n1-normal, n1-square, n4-normal, n4-square, n9-normal, n9-square |
| `Fraction Friends` | 60 | 1 | 44 | plain `nN`: 0–59 (60) |
| `Hundred Billions` | 10 | 1 | 16 | plain `nN`: 0–9 (10) |
| `Hundred Mils` | 11 | 1 | 69 | plain `nN`: 0–9 (10); other: nantilim |
| `Hundred Thousans` | 10 | 1 | 81 | plain `nN`: 0–9 (10) |
| `Hundreds` | 10 | 1 | 113 | plain `nN`: 0–9 (10) |
| `Millions + 10 Mil` | 144 | 1 | 103 | plain `nN`: 0–99 (100); 43 `*-fof`; other: nantilim |
| `Negatives` | 13 | 1 | 112 | 13 non-`nN` costumes |
| `Ten + One` | 145 | 1 | 189 | plain `nN`: 0–99 (100); 44 `*-fof`; other: nanti-size limit |
| `Ten T + Thousands` | 144 | 1 | 61 | plain `nN`: 0–99 (100); 43 `*-fof`; other: nMEMJG |
| `Trillion` | 144 | 1 | 32 | plain `nN`: 0–99 (100); 43 `*-fof`; other: nantilim |

#### `Digits//`

| Target | Costumes | Sounds | Blocks | Notes |
| --- | ---: | ---: | ---: | --- |
| `Billions` | 12 | 1 | 65 | plain `nN`: 0–9 (10); other: n0b, n9-69 |
| `Fractions` | 60 | 1 | 61 | plain `nN`: 0–59 (60) |
| `Hitbox` | 26 | 1 | 71 | plain `nN`: 1–13 (13); 13 non-`nN` costumes |
| `Hundred Thousands` | 11 | 1 | 54 | plain `nN`: 0–9 (10); other: n0b |
| `Hundred Thousands2` | 11 | 1 | 54 | plain `nN`: 0–9 (10); other: n0b |
| `Hundred Thousands3` | 11 | 1 | 54 | plain `nN`: 0–9 (10); other: n0b |
| `Hundreds` | 11 | 1 | 67 | plain `nN`: 0–9 (10); other: n0b |
| `Millions` | 12 | 1 | 65 | plain `nN`: 0–9 (10); other: n0b, n9-69 |
| `Multiplier Ones` | 10 | 1 | 26 | plain `nN`: 0–9 (10) |
| `Multiplier Tenths` | 10 | 1 | 28 | plain `nN`: 0–9 (10) |
| `Multiplier Tenths2` | 10 | 1 | 28 | plain `nN`: 0–9 (10) |
| `Multiplier Thousandths` | 10 | 1 | 28 | plain `nN`: 0–9 (10) |
| `Ones+Negatives` | 62 | 1 | 123 | plain `nN`: 0–9 (10); 52 non-`nN` costumes |
| `Power 100k` | 10 | 1 | 28 | plain `nN`: 0–9 (10) |
| `Power 10k` | 10 | 1 | 28 | plain `nN`: 0–9 (10) |
| `Power 1m` | 10 | 1 | 28 | plain `nN`: 0–9 (10) |
| `Power Hundreds` | 10 | 1 | 28 | plain `nN`: 0–9 (10) |
| `Power Ones` | 10 | 1 | 24 | plain `nN`: 0–9 (10) |
| `Power Tens` | 10 | 1 | 26 | plain `nN`: 0–9 (10) |
| `Power Thousands` | 10 | 1 | 28 | plain `nN`: 0–9 (10) |
| `Ten Billions` | 11 | 1 | 54 | plain `nN`: 0–9 (10); other: n0b |
| `Ten Millions` | 11 | 1 | 54 | plain `nN`: 0–9 (10); other: n0b |
| `Ten Thousands` | 11 | 1 | 63 | plain `nN`: 0–9 (10); other: n0b |
| `Tens` | 11 | 1 | 67 | plain `nN`: 0–9 (10); other: n0b |
| `Thousands` | 12 | 1 | 73 | plain `nN`: 0–9 (10); other: n0b, n9-69 |
| `Trillions` | 11 | 1 | 54 | plain `nN`: 0–9 (10); other: n0b |

#### `assets//`

| Target | Costumes | Sounds | Blocks | Notes |
| --- | ---: | ---: | ---: | --- |
| `10` | 20 | 1 | 0 | costumes `01`–`20` mean 10, 20, … 200 |
| `Body Parts` | 3 | 1 | 0 | other: eyes, mouths, limbs |
| `Earth` | 8 | 1 | 40 | plain `nN`: 1–8 (8) |
| `editor` | 5 | 1 | 0 | other: 모양 1, colors, letters, numbers, mathematical functions |
| `Figured-Out Frenzy` | 11 | 1 | 0 | 11 non-`nN` costumes |
| `Font` | 7 | 0 | 0 | 7 non-`nN` costumes |
| `Fractions` | 7 | 1 | 0 | 7 non-`nN` costumes |
| `Hundred Thousands` | 2 | 0 | 0 | other: One Hundred Thousand, Three Hundred and Fourteen Thousand One Hundred and Fifty-Nine |
| `illions` | 11 | 1 | 0 | 11 non-`nN` costumes |
| `Large Numbers` | 18 | 0 | 0 | 18 non-`nN` costumes |
| `Millions and more` | 13 | 0 | 0 | 13 non-`nN` costumes |
| `Miscellaneous` | 4 | 1 | 0 | other: Badges, Numberblobs, Rays2, n-11 |
| `Numberlings Pack` | 3 | 1 | 0 | other: this is making k to dc, this is making vg to mc, etc |
| `Official Numberblocks 0-100` | 58 | 0 | 0 | 58 non-`nN` costumes |
| `Ten Thousands` | 23 | 0 | 0 | 23 non-`nN` costumes |
| `Thousands (Small)` | 14 | 0 | 0 | 14 non-`nN` costumes |
| `Times Tables` | 25 | 0 | 0 | 25 non-`nN` costumes |

#### `Menu//`

| Target | Costumes | Sounds | Blocks | Notes |
| --- | ---: | ---: | ---: | --- |
| `Add 1` | 2 | 1 | 42 | other: costume2, costume3 |
| `Add 1/2` | 2 | 1 | 46 | other: costume2, costume3 |
| `Add 1/60` | 3 | 1 | 78 | other: costume2, costume3, antilim |
| `Add 10` | 2 | 1 | 43 | other: costume2, costume3 |
| `Add 100` | 2 | 1 | 43 | other: costume2, costume3 |
| `Add 100B` | 2 | 1 | 49 | other: costume2, costume3 |
| `Add 100K` | 2 | 1 | 49 | other: costume2, costume3 |
| `Add 100M` | 2 | 1 | 49 | other: costume2, costume3 |
| `Add 10B` | 2 | 1 | 49 | other: costume2, costume3 |
| `Add 10K` | 2 | 1 | 49 | other: costume2, costume3 |
| `Add 10M` | 2 | 1 | 49 | other: costume2, costume3 |
| `Add 1B` | 2 | 1 | 50 | other: costume2, costume3 |
| `Add 1K` | 2 | 1 | 47 | other: costume2, costume3 |
| `Add 1M` | 2 | 1 | 50 | other: costume2, costume3 |
| `Add 3` | 2 | 1 | 43 | other: costume2, costume3 |
| `Add 30` | 2 | 1 | 43 | other: costume2, costume3 |
| `Add 300` | 2 | 1 | 47 | other: costume2, costume3 |
| `Add Buttons` | 22 | 1 | 94 | 22 non-`nN` costumes |
| `Add X` | 2 | 1 | 63 | other: costume2, costume3 |
| `Auto` | 4 | 1 | 55 | other: costume2, costume3, costume4, costume5 |
| `Auto Select` | 68 | 1 | 51 | 68 non-`nN` costumes |
| `Center Number` | 2 | 1 | 38 | other: costume2, costume3 |
| `Clubs` | 2 | 1 | 44 | other: costume2, costume3 |
| `Clubs Hitbox` | 1 | 1 | 10 | other: n-1 |
| `Clubs Module` | 98 | 1 | 380 | 98 non-`nN` costumes |
| `DIvided Into 10s` | 2 | 1 | 60 | other: costume2, costume3 |
| `DIvided Into 2s` | 2 | 1 | 60 | other: costume2, costume3 |
| `DIvided Into 3s` | 2 | 1 | 60 | other: costume2, costume3 |
| `DIvided Into 5s` | 2 | 1 | 60 | other: costume2, costume3 |
| `DIvided Into 7s` | 2 | 1 | 60 | other: costume2, costume3 |
| `Down` | 2 | 0 | 34 | other: costume1, costume2 |
| `Exponential Mode` | 2 | 1 | 49 | other: costume2, costume3 |
| `Figured-Out Frenzy` | 4 | 1 | 55 | other: costume2, costume3, costume4, costume5 |
| `FOF Watermark` | 1 | 1 | 43 | other: costume1 |
| `Green Screen` | 4 | 1 | 45 | other: 0, 0e0, 1, 1e0 |
| `Info` | 2 | 1 | 42 | other: costume2, costume3 |
| `Info Module` | 112 | 1 | 25 | plain `nN`: 0–1000000 (111); other: nerror |
| `Main Thingy` | 3 | 1 | 98 | other: costume1, costume2, version number |
| `Main Thingy... 2` | 1 | 1 | 9 | other: costume1 |
| `Reset` | 2 | 1 | 39 | other: costume2, costume3 |
| `Say Number` | 2 | 1 | 49 | other: costume2, costume3 |
| `Set` | 2 | 1 | 84 | other: costume2, costume3 |
| `something` | 1 | 1 | 14 | other: Ban |
| `Subtract 1` | 2 | 1 | 42 | other: costume2, costume3 |
| `Subtract 1/2` | 2 | 1 | 46 | other: costume2, costume3 |
| `Subtract 1/60` | 2 | 1 | 43 | other: costume2, costume3 |
| `Subtract 10` | 2 | 1 | 43 | other: costume2, costume3 |
| `Subtract 100` | 2 | 1 | 43 | other: costume2, costume3 |
| `Subtract 100B` | 2 | 1 | 49 | other: costume2, costume3 |
| `Subtract 100K` | 2 | 1 | 49 | other: costume2, costume3 |
| `Subtract 100M` | 2 | 1 | 49 | other: costume2, costume3 |
| `Subtract 10B` | 2 | 1 | 50 | other: costume2, costume3 |
| `Subtract 10K` | 2 | 1 | 49 | other: costume2, costume3 |
| `Subtract 10M` | 2 | 1 | 49 | other: costume2, costume3 |
| `Subtract 1B` | 2 | 1 | 50 | other: costume2, costume3 |
| `Subtract 1K` | 2 | 1 | 47 | other: costume2, costume3 |
| `Subtract 1M` | 2 | 1 | 50 | other: costume2, costume3 |
| `Subtract 3` | 2 | 1 | 43 | other: costume2, costume3 |
| `Subtract 30` | 2 | 1 | 43 | other: costume2, costume3 |
| `Subtract 300` | 2 | 1 | 47 | other: costume2, costume3 |
| `Subtract Buttons` | 22 | 1 | 80 | 22 non-`nN` costumes |
| `Times 10` | 2 | 1 | 55 | other: costume2, costume3 |
| `Times 2` | 2 | 1 | 55 | other: costume2, costume3 |
| `Times 3` | 2 | 1 | 55 | other: costume2, costume3 |
| `Times 5` | 2 | 1 | 55 | other: costume2, costume3 |
| `Times 7` | 2 | 1 | 55 | other: costume2, costume3 |
| `Times X` | 2 | 1 | 62 | other: costume2, costume3 |
| `Up` | 2 | 0 | 34 | other: costume1, costume2 |

## What matters for number → costume mapping

Ignore `Menu//*` for rendering Numberblocks. Useful groups:

### 1. Named official characters — `assets//Official Numberblocks 0-100`

These are the face/limb “TV” costumes. **58** costumes (not every integer 0–100):

```
Zero
One
Two
Three
Four
Five
Six
Seven
Eight
Nine
Ten
Eleven
Twelve
Thirteen
Fourteen
Fifteen
Sixteen
Seventeen
Eighteen
Nineteen
Twenty
Twenty-One
Twenty-Two
Twenty-Three
Twenty-Four
Twenty-Five
Twenty-Six
Twenty-Seven
Twenty-Eight
Twenty-Nine
Thirty
Thirty-One
Thirty-Two
Thirty-Three
Thirty-Four
Thirty-Five
Thirty-Six
Thirty-Seven
Thirty-Eight
Thirty-Nine
Forty
Forty-Two
Forty-Five
Forty-Eight
Forty-Nine
Fifty
Fifty-Four
Fifty-Five
Fifty-Six
Sixty
Sixty-Three
Sixty-Four
Seventy
Seventy-Two
Eighty
Eighty-One
Ninety
One Hundred
```

Numeric values present:

```
0–40, 42, 45, 48, 49, 50, 54, 55, 56, 60, 63, 64, 70, 72, 80, 81, 90, 100
```

Missing from this pack but common in-show / FOF: **41, 43, 44, 46, 47, 51–53, 57–59, 61, 62, 65–69, 71, 73–79, 82–89, 91–99** (see FOF below).

### 2. Figured-Out Frenzy named faces — `assets//Figured-Out Frenzy`

Extra named characters (SVG faces) not in the official 0–100 pack:

```
Forty-Four
Sixty-Five
Sixty-Six
Sixty-Eight
Seventy-Five
Seventy-Seven
Eighty-Four
Eighty-Eight
Ninety-One
Ninety-Six
Ninety-Nine
```

Values: **44, 65, 66, 68, 75, 77, 84, 88, 91, 96, 99**.

### 3. FOF costume variants on place-value sprites — `*-fof`

Stage list `figured-out frenzy guys` enumerates every FOF integer the generator treats specially:

```
41, 43, 44, 46, 47, 51, 52, 53, 57, 58, 59, 61, 62, 65, 66, 67, 68, 69, 71, 73, 74, 75, 76, 77, 78, 79, 82, 83, 84, 85, 86, 87, 88, 89, 91, 92, 93, 94, 95, 96, 97, 98, 99
```

On `NBs//Ten + One` (and the other 0–99 place sprites), those numbers usually have both:

- `n44` — plain / default body
- `n44-fof` — figured-out frenzy body (preferred when FOF mode is on)

`NBs//Ten + One` also has `n77-fof2` (extra variant).

### 4. Generated place-value chunks — `NBs//*`

Large integers are **not** stored as one SVG each. The Scratch project composes decimal chunks:

| Place group | Target | Costume pattern | Chunk range | Divisor |
| --- | --- | --- | --- | ---: |
| ones + tens | `NBs//Ten + One` | `n0`…`n99` (+ `*-fof`) | 0–99 | 1 |
| hundreds | `NBs//Hundreds` | `n0`…`n9` | 0–9 | 100 |
| thousands + ten-thousands | `NBs//Ten T + Thousands` | `n0`…`n99` (+ `*-fof`) | 0–99 | 1_000 |
| hundred-thousands | `NBs//Hundred Thousans` | `n0`…`n9` | 0–9 | 100_000 |
| millions + ten-millions | `NBs//Millions + 10 Mil` | `n0`…`n99` (+ `*-fof`) | 0–99 | 1_000_000 |
| hundred-millions | `NBs//Hundred Mils` | `n0`…`n9` | 0–9 | 100_000_000 |
| billions + ten-billions | `NBs//Billions` | `n0`…`n99` (+ `*-fof`) | 0–99 | 1_000_000_000 |
| hundred-billions | `NBs//Hundred Billions` | `n0`…`n9` | 0–9 | 100_000_000_000 |
| trillions + ten-trillions | `NBs//Trillion` | `n0`…`n99` (+ `*-fof`) | 0–99 | 1_000_000_000_000 |

Example decompositions (Scratch place chunks, highest place first):

```
7      -> Ten + One / n7
144    -> Hundreds / n1  +  Ten + One / n44   (or n44-fof)
234    -> Hundreds / n2  +  Ten + One / n34
12345  -> Ten T + Thousands / n12  +  Hundreds / n3  +  Ten + One / n45
```

Related mode sprites (not used by the current web mapper yet):

- `NBs//Fraction Friends` — `n0`…`n59`
- `NBs//Negatives` — strip costumes / frames for negatives
- `NBs//Exp Ones/Tens`, `NBs//Exp 100`, `NBs//Exp Smol10+1`, `NBs//Exp Smol100` — exponential layouts; square numbers often have `nN-normal` / `nN-square`

### 5. Large named characters — `assets//Large Numbers` and friends

Single-costume “hero” drawings for round / special large values:

#### `assets//10`

Costumes are labeled `01`–`20` and are ten times that label: `01` is 10, `18` is 180, `20` is 200. Official faces still win for 10–100. 110–190 are exact costumes (177 stays 100+77). 200 uses this full-size costume; `Large Numbers` / `Two Hundred` is a miniature and is not used.

#### `assets//Large Numbers`
```
One Hundred
Two Hundred
Three Hundred
Four Hundred
Five Hundred
Six Hundred
Seven Hundred
Eight Hundred
Nine Hundred
One Thousand
Ten Thousand
Ninety-Seven Thousand One Hundred and Four
One Hundred Thousand
One Million
Ten Million
One Hundred Million
One Billion
One Trillion
```

#### `assets//Thousands (Small)`
```
One Thousand
Two Thousand
Two Thousand and Twenty-Four
Two Thousand and Twenty-Five
Two Thousand and Forty-Eight
Three Thousand
Four Thousand
Five Thousand
Six Thousand
Seven Thousand
Seven Thousand Five Hundred
Eight Thousand
Nine Thousand
(Old) Nine Thousand Nine Hundred
```

#### `assets//Ten Thousands`
```
Ten Thousand
Eleven Thousand
Twelve Thousand
Thirteen Thousand
Fourteen Thousand
Fifteen Thousand
Sixteen Thousand
Seventeen Thousand
Eighteen Thousand
Nineteen Thousand3
Twenty Thousand
Thirty Thousand
Thirty-Two Thousand Seven Hundred and Sixty-Seven
Forty Thousand
Forty Thousand (square eyes)
Fifty Thousand
Sixty Thousand
Sixty-Five Thousand Five Hundred and Thirty-Six
Seventy Thousand
Eighty Thousand
Ninety Thousand
Ninety-Seven Thousand One Hundred and Four
Ninety-Seven Thousand One Hundred and Four (Compound)
```

#### `assets//Hundred Thousands`
```
One Hundred Thousand
Three Hundred and Fourteen Thousand One Hundred and Fifty-Nine
```

#### `assets//Millions and more`
```
One Million
Two Million
Three Million
Four Million
Five Million
Six Million
Seven Million
Eight Million
Nine Million
Ten Million
One Hundred Million
One Billion
One Trillion
```

### 6. Spoken names — Stage sounds

Stage holds spoken `n0`…`n100`, round hundreds `n200`…`n900`, and illion glue sounds. There is **no** `n144` sound; names for composites are assembled at runtime in Scratch.

Relevant name patterns:

```
nNeg0, nNeg3, nNeg2, nNeg1, n0, n1, n1-k, n1-m, n2, n3, n4, n5, n6, n7, n8, n9, n10, n10-k, n11, n12, n13, n14, n15, n16, n17, n18, n19, n20, n21, n22, n23, n24, n25, n26, n27, n28, n29, n30, n31, n32, n33, n34, n35, n36, n37, n38, n39, n40, n41, n42, n43, n44, n45, n46, n47, n48, n49, n50, n51, n52, n53, n54, n55, n56, n57, n58, n59, n60, n61, n62, n63, n64, n65, n66, n67, n68, n69, n70, n71, n72, n73, n74, n75, n76, n77, n78, n79, n80, n81, n82, n83, n84, n85, n86, n87, n88, n89, n90, n91, n92, n93, n94, n95, n96, n97, n98, n99, n100, n100-k, n200, n300, n400, n500, n600, n700, n800, n900, nthousand-0, nthousand-1, nthousand-2, nmillion, nbillion, ntrillion, nillion-0, nillion-1, nillion-2, nillion-3, nillion-4, nillion-5, nillion-6, nillion-7, nillion-8, nillion-9, nillion-10, nillion-20, nillion-30, nillion-40, nillion-50, nillion-60, nillion-70, nillion-80, nillion-90, nillion-100, nillion-200, nillion-300, nillion-400, nillion-500, nillion-600, nillion-700, nillion-800, nillion-900, nillion-1000, nillion-1000000, nillion-p1, nillion-p2, nillion-p3, nillion-p4, nillion-p5, nillion-p6, nillion-p7, nillion-p8, nillion-p9, nillion-sep
```

## Web mapper resolution order

Implemented in [`numberblocksSb3.ts`](../src/lib/numberblocksSb3.ts):

1. **Exact named face** in `assets//Official Numberblocks 0-100`.
2. **FOF named face** in `assets//Figured-Out Frenzy` (44, 65, 66, 68, 75, 77, 84, 88, 91, 96, 99).
3. **Named large costume** (`assets//10`, `Large Numbers`, `Thousands*`, `Millions and more`) — round values are greedy atoms; odd specials (2024, 97104, …) and tens-pack 110–190 are exact-only. `assets//10` costumes `01`–`20` are 10–200. Official faces still win for 10–100.
4. Else if `0 ≤ n ≤ 99`: `NBs//Ten + One` / `n{n}-fof` when `n` is in `figured-out frenzy guys`, else `n{n}`.
5. Else **additive character split** via `splitOfficialAddends()` over official ∪ FOF ∪ round larges (so every 0–100 is an atom).
6. Place-value compose via `NUMBER_GROUPS` (`getNumberParts`) remains available for non-character layouts.

Examples:

```
77   -> Seventy-Seven          (FOF named)
144  -> 100 + 44               (One Hundred + Forty-Four)
177  -> 100 + 77
180  -> assets//10 / 18        (exact; not 100+80)
190  -> assets//10 / 19
200  -> assets//10 / 20        (full size)
1234 -> 1000 + 200 + 34
```

## Stage variables / lists (generator state)

Useful when reading Scratch scripts:

| Kind | Name | Role |
| --- | --- | --- |
| var | `num` | current value |
| var | `figured out frenzy?` | toggles FOF costumes |
| var | `exponential mode` | switches Exp sprites |
| var | `fraction` | fraction mode |
| var | `max` / `min` | range clamps (`1e12` / `-49`) |
| list | `figured-out frenzy guys` | FOF integers (43) |
| list | `brightness effects` | per-place brightness keys |
| list | `button values` | menu add amounts |

## Digits / Menu / misc

- `Digits//*` — numeral glyphs for the on-canvas number readout (ones…trillions, powers, multipliers, fractions). Not Numberblock bodies.
- `Menu//*` — UI chrome for the Scratch generator.
- `assets//Times Tables`, `assets//Fractions`, `assets//Body Parts`, `assets//Font`, `Galaxy` — supporting art; only pull in if a feature needs them.
- `Menu//Info Module` has info cards `n0`…`n103`, plus selected large keys (`n200`, `n300`, `n1000`, …) — metadata UI, not the main body sprites.

## Full costume lists for mapping-critical targets

### `NBs//Ten + One`

```
  0  n0
  1  n1
  2  n2
  3  n3
  4  n4
  5  n5
  6  n6
  7  n7
  8  n8
  9  n9
 10  n10
 11  n11
 12  n12
 13  n13
 14  n14
 15  n15
 16  n16
 17  n17
 18  n18
 19  n19
 20  n20
 21  n21
 22  n22
 23  n23
 24  n24
 25  n25
 26  n26
 27  n27
 28  n28
 29  n29
 30  n30
 31  n31
 32  n32
 33  n33
 34  n34
 35  n35
 36  n36
 37  n37
 38  n38
 39  n39
 40  n40
 41  n41
 42  n41-fof
 43  n42
 44  n43
 45  n43-fof
 46  n44
 47  n44-fof
 48  n45
 49  n46
 50  n46-fof
 51  n47
 52  n47-fof
 53  n48
 54  n49
 55  n50
 56  n51
 57  n51-fof
 58  n52
 59  n52-fof
 60  n53
 61  n53-fof
 62  n54
 63  n55
 64  n56
 65  n57
 66  n57-fof
 67  n58
 68  n58-fof
 69  n59
 70  n59-fof
 71  n60
 72  n61
 73  n61-fof
 74  n62
 75  n62-fof
 76  n63
 77  n64
 78  n65
 79  n65-fof
 80  n66
 81  n66-fof
 82  n67
 83  n67-fof
 84  n68
 85  n68-fof
 86  n69
 87  n69-fof
 88  n70
 89  n71
 90  n71-fof
 91  n72
 92  n73
 93  n73-fof
 94  n74
 95  n74-fof
 96  n75
 97  n75-fof
 98  n76
 99  n76-fof
100  n77
101  n77-fof
102  n78
103  n78-fof
104  n79
105  n79-fof
106  n80
107  n81
108  n82
109  n82-fof
110  n83
111  n83-fof
112  n84
113  n84-fof
114  n85
115  n85-fof
116  n86
117  n86-fof
118  n87
119  n87-fof
120  n88
121  n88-fof
122  n89
123  n89-fof
124  n90
125  n91
126  n91-fof
127  n92
128  n92-fof
129  n93
130  n93-fof
131  n94
132  n94-fof
133  n95
134  n95-fof
135  n96
136  n96-fof
137  n97
138  n97-fof
139  n98
140  n98-fof
141  n99
142  n99-fof
143  nanti-size limit
144  n77-fof2
```

### `NBs//Hundreds`

```
  0  n0
  1  n1
  2  n2
  3  n3
  4  n4
  5  n5
  6  n6
  7  n7
  8  n8
  9  n9
```

### `NBs//Ten T + Thousands`

```
  0  n0
  1  n1
  2  n2
  3  n3
  4  n4
  5  n5
  6  n6
  7  n7
  8  n8
  9  n9
 10  n10
 11  n11
 12  n12
 13  n13
 14  n14
 15  n15
 16  n16
 17  n17
 18  n18
 19  n19
 20  n20
 21  n21
 22  n22
 23  n23
 24  n24
 25  n25
 26  n26
 27  n27
 28  n28
 29  n29
 30  n30
 31  n31
 32  n32
 33  n33
 34  n34
 35  n35
 36  n36
 37  n37
 38  n38
 39  n39
 40  n40
 41  n41
 42  n41-fof
 43  n42
 44  n43
 45  n43-fof
 46  n44
 47  n44-fof
 48  n45
 49  n46
 50  n46-fof
 51  n47
 52  n47-fof
 53  n48
 54  n49
 55  n50
 56  n51
 57  n51-fof
 58  n52
 59  n52-fof
 60  n53
 61  n53-fof
 62  n54
 63  n55
 64  n56
 65  n57
 66  n57-fof
 67  n58
 68  n58-fof
 69  n59
 70  n59-fof
 71  n60
 72  n61
 73  n61-fof
 74  n62
 75  n62-fof
 76  n63
 77  n64
 78  n65
 79  n65-fof
 80  n66
 81  n66-fof
 82  n67
 83  n67-fof
 84  n68
 85  n68-fof
 86  n69
 87  n69-fof
 88  n70
 89  n71
 90  n71-fof
 91  n72
 92  n73
 93  n73-fof
 94  n74
 95  n74-fof
 96  n75
 97  n75-fof
 98  n76
 99  n76-fof
100  n77
101  n77-fof
102  n78
103  n78-fof
104  n79
105  n79-fof
106  n80
107  n81
108  n82
109  n82-fof
110  n83
111  n83-fof
112  n84
113  n84-fof
114  n85
115  n85-fof
116  n86
117  n86-fof
118  n87
119  n87-fof
120  n88
121  n88-fof
122  n89
123  n89-fof
124  n90
125  n91
126  n91-fof
127  n92
128  n92-fof
129  n93
130  n93-fof
131  n94
132  n94-fof
133  n95
134  n95-fof
135  n96
136  n96-fof
137  n97
138  n97-fof
139  n98
140  n98-fof
141  n99
142  n99-fof
143  nMEMJG
```

### `NBs//Hundred Thousans`

```
  0  n0
  1  n1
  2  n2
  3  n3
  4  n4
  5  n5
  6  n6
  7  n7
  8  n8
  9  n9
```

### `NBs//Millions + 10 Mil`

```
  0  n0
  1  n1
  2  n2
  3  n3
  4  n4
  5  n5
  6  n6
  7  n7
  8  n8
  9  n9
 10  n10
 11  n11
 12  n12
 13  n13
 14  n14
 15  n15
 16  n16
 17  n17
 18  n18
 19  n19
 20  n20
 21  n21
 22  n22
 23  n23
 24  n24
 25  n25
 26  n26
 27  n27
 28  n28
 29  n29
 30  n30
 31  n31
 32  n32
 33  n33
 34  n34
 35  n35
 36  n36
 37  n37
 38  n38
 39  n39
 40  n40
 41  n41
 42  n41-fof
 43  n42
 44  n43
 45  n43-fof
 46  n44
 47  n44-fof
 48  n45
 49  n46
 50  n46-fof
 51  n47
 52  n47-fof
 53  n48
 54  n49
 55  n50
 56  n51
 57  n51-fof
 58  n52
 59  n52-fof
 60  n53
 61  n53-fof
 62  n54
 63  n55
 64  n56
 65  n57
 66  n57-fof
 67  n58
 68  n58-fof
 69  n59
 70  n59-fof
 71  n60
 72  n61
 73  n61-fof
 74  n62
 75  n62-fof
 76  n63
 77  n64
 78  n65
 79  n65-fof
 80  n66
 81  n66-fof
 82  n67
 83  n67-fof
 84  n68
 85  n68-fof
 86  n69
 87  n69-fof
 88  n70
 89  n71
 90  n71-fof
 91  n72
 92  n73
 93  n73-fof
 94  n74
 95  n74-fof
 96  n75
 97  n75-fof
 98  n76
 99  n76-fof
100  n77
101  n77-fof
102  n78
103  n78-fof
104  n79
105  n79-fof
106  n80
107  n81
108  n82
109  n82-fof
110  n83
111  n83-fof
112  n84
113  n84-fof
114  n85
115  n85-fof
116  n86
117  n86-fof
118  n87
119  n87-fof
120  n88
121  n88-fof
122  n89
123  n89-fof
124  n90
125  n91
126  n91-fof
127  n92
128  n92-fof
129  n93
130  n93-fof
131  n94
132  n94-fof
133  n95
134  n95-fof
135  n96
136  n96-fof
137  n97
138  n97-fof
139  n98
140  n98-fof
141  n99
142  n99-fof
143  nantilim
```

### `NBs//Hundred Mils`

```
  0  n0
  1  nantilim
  2  n1
  3  n2
  4  n3
  5  n4
  6  n5
  7  n6
  8  n7
  9  n8
 10  n9
```

### `NBs//Billions`

```
  0  n0
  1  n1
  2  n2
  3  n3
  4  n4
  5  n5
  6  n6
  7  n7
  8  n8
  9  n9
 10  n10
 11  n11
 12  n12
 13  n13
 14  n14
 15  n15
 16  n16
 17  n17
 18  n18
 19  n19
 20  n20
 21  n21
 22  n22
 23  n23
 24  n24
 25  n25
 26  n26
 27  n27
 28  n28
 29  n29
 30  n30
 31  n31
 32  n32
 33  n33
 34  n34
 35  n35
 36  n36
 37  n37
 38  n38
 39  n39
 40  n40
 41  n41
 42  n41-fof
 43  n42
 44  n43
 45  n43-fof
 46  n44
 47  n44-fof
 48  n45
 49  n46
 50  n46-fof
 51  n47
 52  n47-fof
 53  n48
 54  n49
 55  n50
 56  n51
 57  n51-fof
 58  n52
 59  n52-fof
 60  n53
 61  n53-fof
 62  n54
 63  n55
 64  n56
 65  n57
 66  n57-fof
 67  n58
 68  n58-fof
 69  n59
 70  n59-fof
 71  n60
 72  n61
 73  n61-fof
 74  n62
 75  n62-fof
 76  n63
 77  n64
 78  n65
 79  n65-fof
 80  n66
 81  n66-fof
 82  n67
 83  n67-fof
 84  n68
 85  n68-fof
 86  n69
 87  n69-fof
 88  n70
 89  n71
 90  n71-fof
 91  n72
 92  n73
 93  n73-fof
 94  n74
 95  n74-fof
 96  n75
 97  n75-fof
 98  n76
 99  n76-fof
100  n77
101  n77-fof
102  n78
103  n78-fof
104  n79
105  n79-fof
106  n80
107  n81
108  n82
109  n82-fof
110  n83
111  n83-fof
112  n84
113  n84-fof
114  n85
115  n85-fof
116  n86
117  n86-fof
118  n87
119  n87-fof
120  n88
121  n88-fof
122  n89
123  n89-fof
124  n90
125  n91
126  n91-fof
127  n92
128  n92-fof
129  n93
130  n93-fof
131  n94
132  n94-fof
133  n95
134  n95-fof
135  n96
136  n96-fof
137  n97
138  n97-fof
139  n98
140  n98-fof
141  n99
142  n99-fof
```

### `NBs//Hundred Billions`

```
  0  n0
  1  n1
  2  n2
  3  n3
  4  n4
  5  n5
  6  n6
  7  n7
  8  n8
  9  n9
```

### `NBs//Trillion`

```
  0  n0
  1  n1
  2  n2
  3  n3
  4  n4
  5  n5
  6  n6
  7  n7
  8  n8
  9  n9
 10  n10
 11  n11
 12  n12
 13  n13
 14  n14
 15  n15
 16  n16
 17  n17
 18  n18
 19  n19
 20  n20
 21  n21
 22  n22
 23  n23
 24  n24
 25  n25
 26  n26
 27  n27
 28  n28
 29  n29
 30  n30
 31  n31
 32  n32
 33  n33
 34  n34
 35  n35
 36  n36
 37  n37
 38  n38
 39  n39
 40  n40
 41  n41
 42  n41-fof
 43  n42
 44  n43
 45  n43-fof
 46  n44
 47  n44-fof
 48  n45
 49  n46
 50  n46-fof
 51  n47
 52  n47-fof
 53  n48
 54  n49
 55  n50
 56  n51
 57  n51-fof
 58  n52
 59  n52-fof
 60  n53
 61  n53-fof
 62  n54
 63  n55
 64  n56
 65  n57
 66  n57-fof
 67  n58
 68  n58-fof
 69  n59
 70  n59-fof
 71  n60
 72  n61
 73  n61-fof
 74  n62
 75  n62-fof
 76  n63
 77  n64
 78  n65
 79  n65-fof
 80  n66
 81  n66-fof
 82  n67
 83  n67-fof
 84  n68
 85  n68-fof
 86  n69
 87  n69-fof
 88  n70
 89  n71
 90  n71-fof
 91  n72
 92  n73
 93  n73-fof
 94  n74
 95  n74-fof
 96  n75
 97  n75-fof
 98  n76
 99  n76-fof
100  n77
101  n77-fof
102  n78
103  n78-fof
104  n79
105  n79-fof
106  n80
107  n81
108  n82
109  n82-fof
110  n83
111  n83-fof
112  n84
113  n84-fof
114  n85
115  n85-fof
116  n86
117  n86-fof
118  n87
119  n87-fof
120  n88
121  n88-fof
122  n89
123  n89-fof
124  n90
125  n91
126  n91-fof
127  n92
128  n92-fof
129  n93
130  n93-fof
131  n94
132  n94-fof
133  n95
134  n95-fof
135  n96
136  n96-fof
137  n97
138  n97-fof
139  n98
140  n98-fof
141  n99
142  n99-fof
143  nantilim
```

### `NBs//Fraction Friends`

```
  0  n0
  1  n1
  2  n2
  3  n3
  4  n4
  5  n5
  6  n6
  7  n7
  8  n8
  9  n9
 10  n10
 11  n11
 12  n12
 13  n13
 14  n14
 15  n15
 16  n16
 17  n17
 18  n18
 19  n19
 20  n20
 21  n21
 22  n22
 23  n23
 24  n24
 25  n25
 26  n26
 27  n27
 28  n28
 29  n29
 30  n30
 31  n31
 32  n32
 33  n33
 34  n34
 35  n35
 36  n36
 37  n37
 38  n38
 39  n39
 40  n40
 41  n41
 42  n42
 43  n43
 44  n44
 45  n45
 46  n46
 47  n47
 48  n48
 49  n49
 50  n50
 51  n51
 52  n52
 53  n53
 54  n54
 55  n55
 56  n56
 57  n57
 58  n58
 59  n59
```

### `NBs//Exp Ones/Tens`

```
  0  n0
  1  n1-normal
  2  n1-square
  3  n2
  4  n3
  5  n4-normal
  6  n4-square
  7  n5
  8  n6
  9  n7
 10  n8
 11  n9-normal
 12  n9-square
 13  n10-normal
 14  n10-square
 15  n11
 16  n12
 17  n13
 18  n14
 19  n15
 20  n16-normal
 21  n16-square
 22  n17
 23  n18
 24  n19
 25  n20
 26  n21
 27  n22
 28  n23
 29  n24
 30  n25-normal
 31  n25-square
 32  n26
 33  n27
 34  n28
 35  n29
 36  n30
 37  n31
 38  n32
 39  n33
 40  n34
 41  n35
 42  n36-normal
 43  n36-square
 44  n37
 45  n38
 46  n39
 47  n40-normal
 48  n40-square
 49  n41-normal
 50  n41-square
 51  n41-fof
 52  n42
 53  n43-normal
 54  n43-square
 55  n43-fof
 56  n44-normal
 57  n44-square
 58  n44-fof
 59  n45
 60  n46-normal
 61  n46-square
 62  n46-fof
 63  n47-normal
 64  n47-square
 65  n47-fof
 66  n48
 67  n49-normal
 68  n49-square
 69  n50
 70  n51
 71  n51-fof
 72  n52
 73  n52-fof
 74  n53
 75  n53-fof
 76  n54
 77  n55
 78  n56
 79  n57
 80  n57-fof
 81  n58
 82  n58-fof
 83  n59
 84  n59-fof
 85  n60
 86  n61
 87  n61-fof
 88  n62
 89  n62-fof
 90  n63
 91  n64-normal
 92  n64-square
 93  n65
 94  n65-fof
 95  n66
 96  n66-fof
 97  n67
 98  n67-fof
 99  n68
100  n68-fof
101  n69
102  n69-fof
103  n70
104  n71
105  n71-fof
106  n72
107  n73
108  n73-fof
109  n74
110  n74-fof
111  n75
112  n75-fof
113  n76
114  n76-fof
115  n77
116  n77-fof
117  n78
118  n78-fof
119  n79
120  n79-fof
121  n80
122  n81-normal
123  n81-square
124  n82
125  n82-fof
126  n83
127  n83-fof
128  n84
129  n84-fof
130  n85
131  n85-fof
132  n86
133  n86-fof
134  n87
135  n87-fof
136  n88
137  n88-fof
138  n89
139  n89-fof
140  n90
141  n91
142  n91-fof
143  n92
144  n92-fof
145  n93
146  n93-fof
147  n94
148  n94-fof
149  n95
150  n95-fof
151  n96
152  n96-fof
153  n97
154  n97-fof
155  n98
156  n98-fof
157  n99
158  n99-fof
159  nantilim
```

### `NBs//Exp 100`

```
  0  n0
  1  n1-normal
  2  n1-square
  3  n2
  4  n3
  5  n4-normal
  6  n4-square
  7  n5
  8  n6
  9  n7
 10  n8
 11  n9-normal
 12  n9-square
```

### `assets//Official Numberblocks 0-100`

```
  0  Zero
  1  One
  2  Two
  3  Three
  4  Four
  5  Five
  6  Six
  7  Seven
  8  Eight
  9  Nine
 10  Ten
 11  Eleven
 12  Twelve
 13  Thirteen
 14  Fourteen
 15  Fifteen
 16  Sixteen
 17  Seventeen
 18  Eighteen
 19  Nineteen
 20  Twenty
 21  Twenty-One
 22  Twenty-Two
 23  Twenty-Three
 24  Twenty-Four
 25  Twenty-Five
 26  Twenty-Six
 27  Twenty-Seven
 28  Twenty-Eight
 29  Twenty-Nine
 30  Thirty
 31  Thirty-One
 32  Thirty-Two
 33  Thirty-Three
 34  Thirty-Four
 35  Thirty-Five
 36  Thirty-Six
 37  Thirty-Seven
 38  Thirty-Eight
 39  Thirty-Nine
 40  Forty
 41  Forty-Two
 42  Forty-Five
 43  Forty-Eight
 44  Forty-Nine
 45  Fifty
 46  Fifty-Four
 47  Fifty-Five
 48  Fifty-Six
 49  Sixty
 50  Sixty-Three
 51  Sixty-Four
 52  Seventy
 53  Seventy-Two
 54  Eighty
 55  Eighty-One
 56  Ninety
 57  One Hundred
```

### `assets//Figured-Out Frenzy`

```
  0  Forty-Four
  1  Sixty-Five
  2  Sixty-Six
  3  Sixty-Eight
  4  Seventy-Five
  5  Seventy-Seven
  6  Eighty-Four
  7  Eighty-Eight
  8  Ninety-One
  9  Ninety-Six
 10  Ninety-Nine
```

### `assets//Large Numbers`

```
  0  One Hundred
  1  Two Hundred
  2  Three Hundred
  3  Four Hundred
  4  Five Hundred
  5  Six Hundred
  6  Seven Hundred
  7  Eight Hundred
  8  Nine Hundred
  9  One Thousand
 10  Ten Thousand
 11  Ninety-Seven Thousand One Hundred and Four
 12  One Hundred Thousand
 13  One Million
 14  Ten Million
 15  One Hundred Million
 16  One Billion
 17  One Trillion
```

### `assets//Thousands (Small)`

```
  0  One Thousand
  1  Two Thousand
  2  Two Thousand and Twenty-Four
  3  Two Thousand and Twenty-Five
  4  Two Thousand and Forty-Eight
  5  Three Thousand
  6  Four Thousand
  7  Five Thousand
  8  Six Thousand
  9  Seven Thousand
 10  Seven Thousand Five Hundred
 11  Eight Thousand
 12  Nine Thousand
 13  (Old) Nine Thousand Nine Hundred
```

### `assets//Ten Thousands`

```
  0  Ten Thousand
  1  Eleven Thousand
  2  Twelve Thousand
  3  Thirteen Thousand
  4  Fourteen Thousand
  5  Fifteen Thousand
  6  Sixteen Thousand
  7  Seventeen Thousand
  8  Eighteen Thousand
  9  Nineteen Thousand3
 10  Twenty Thousand
 11  Thirty Thousand
 12  Thirty-Two Thousand Seven Hundred and Sixty-Seven
 13  Forty Thousand
 14  Forty Thousand (square eyes)
 15  Fifty Thousand
 16  Sixty Thousand
 17  Sixty-Five Thousand Five Hundred and Thirty-Six
 18  Seventy Thousand
 19  Eighty Thousand
 20  Ninety Thousand
 21  Ninety-Seven Thousand One Hundred and Four
 22  Ninety-Seven Thousand One Hundred and Four (Compound)
```

### `assets//Hundred Thousands`

```
  0  One Hundred Thousand
  1  Three Hundred and Fourteen Thousand One Hundred and Fifty-Nine
```

### `assets//Millions and more`

```
  0  One Million
  1  Two Million
  2  Three Million
  3  Four Million
  4  Five Million
  5  Six Million
  6  Seven Million
  7  Eight Million
  8  Nine Million
  9  Ten Million
 10  One Hundred Million
 11  One Billion
 12  One Trillion
```
