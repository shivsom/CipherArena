// Single source of truth for every challenge on the platform.
//  - server/challenges/build.js reads it to generate the downloadable files in server/challenge-files/
//  - server/challenges/sync.js reads it to upsert the Challenge documents (flags are stored hashed)
//
// `file` is the name of the generated download, `room` is 'free' or 'premium'.
module.exports = [
  // ------------------------------------------------------------------ FREE ROOM
  {
    title: "Caesar's Secret", category: 'Crypto', points: 100, room: 'free', file: 'caesar.txt',
    flag: 'CA{r0t13_1s_n0t_encrypt10n}',
    description: 'A rookie "encrypted" the club password by shifting every letter. Download the note and undo the shift.',
    hint: 'Only letters move. Digits, braces and underscores stay put. Try ROT13.',
  },
  {
    title: 'Strings Attached', category: 'Forensics', points: 100, room: 'free', file: 'mystery.bin',
    flag: 'CA{str1ngs_f1nds_th3_fl4g}',
    description: 'An unknown binary was found on a lab PC. It will not run, but it is not completely silent.',
    hint: 'Printable text hides inside binaries. Use the `strings` command and grep for CA{.',
  },
  {
    title: 'Hidden in Plain Sight', category: 'Forensics', points: 150, room: 'free', file: 'club_trip.png',
    flag: 'CA{m3tadata_t3lls_all}',
    description: 'A photo from the club trip hides more than memories. Nobody looked at what is attached to the picture.',
    hint: 'Images carry metadata chunks. Try exiftool, pngcheck or a hex editor.',
  },
  {
    title: 'Morse Mayhem', category: 'Crypto', points: 150, room: 'free', file: 'transmission.txt',
    flag: 'CA{DOTS_AND_DASHES_4EVER}',
    description: 'A radio operator transmitted the flag in Morse code. Words are separated by " / ".',
    hint: 'Decode with any Morse translator. Keep the letters uppercase and rebuild the braces.',
  },
  {
    title: 'Base64 Onion', category: 'Crypto', points: 200, room: 'free', file: 'onion.txt',
    flag: 'CA{p33l_th3_0n10n}',
    description: 'Twenty layers of Base64. Keep peeling.',
    hint: 'Do not decode by hand — write a loop that decodes until the text starts with CA{.',
  },
  {
    title: 'Broken Magic', category: 'Forensics', points: 200, room: 'free', file: 'broken.png',
    flag: 'CA{m4gic_byt3s_r3p41red}',
    description: 'This image refuses to open in every viewer. Someone damaged its first bytes.',
    hint: 'Every PNG starts with 89 50 4E 47 0D 0A 1A 0A. Fix the header, then read its metadata.',
  },
  {
    title: 'Vigenère Vault', category: 'Crypto', points: 250, room: 'free', file: 'vault.txt',
    flag: 'CA{p0lyalphabet1c_pr0}',
    description: 'The vault message uses a repeating key. The key is the name of this platform (one word, lowercase).',
    hint: 'Vigenère cipher, key "cipherarena". Only letters are shifted.',
  },
  {
    title: 'Packet Sniffer', category: 'Forensics', points: 300, room: 'free', file: 'capture.pcap',
    flag: 'CA{wir3shark_w1zard}',
    description: 'An FTP login was captured in a pcap file. The first attempt failed — the flag is the password that worked.',
    hint: 'Open the capture in Wireshark and use Follow → TCP Stream on the FTP control connection.',
  },
  {
    title: 'Reverse Me', category: 'Reverse', points: 400, room: 'free', file: 'reverse_me.py',
    flag: 'CA{xor_1s_r3v3rs1bl3}',
    description: 'A crackme that scrambles your input and compares it to a stored answer. Find the input it accepts.',
    hint: 'XOR is its own inverse. Undo the steps in reverse order — or let the script print the answer for you.',
  },

  // ------------------------------------------------------------ PREMIUM ROOM
  {
    title: 'Zero Width Whisper', category: 'Forensics', points: 300, room: 'premium', file: 'announcement.txt',
    flag: 'CA{inv1s1ble_1nk_unm4sked}',
    description: 'A harmless club announcement. Select it all, copy it, paste it somewhere else — the text is longer than it looks.',
    hint: 'Look for zero-width characters (U+200B / U+200C). Map them to 0 and 1 and read the bits as ASCII.',
  },
  {
    title: 'RSA: Close Primes', category: 'Crypto', points: 400, room: 'premium', file: 'rsa.txt',
    flag: 'CA{f3rmat_f4ct0rs_cl0se_pr1mes}',
    description: 'We generated an RSA key, but picked the second prime lazily. Recover the message.',
    hint: 'When p and q are close, n = a² − b². Fermat factorisation finds them in milliseconds.',
  },
  {
    title: 'LSB Ghost', category: 'Forensics', points: 450, room: 'premium', file: 'ghost.png',
    flag: 'CA{l34st_s1gn1f1c4nt_b1t}',
    description: 'The gradient looks perfectly innocent. The message lives in the pixels themselves.',
    hint: 'Read the least-significant bit of the red channel, row by row, 8 bits per character. Python + Pillow is enough.',
  },
  {
    title: 'DNS Exfil', category: 'Forensics', points: 500, room: 'premium', file: 'exfil.pcap',
    flag: 'CA{dns_t00_ch4tty_f0r_s3cr3ts}',
    description: 'An insider smuggled data out of the network through DNS lookups. Put the stolen data back together, in order.',
    hint: 'Filter dns in Wireshark. The subdomain labels are hex. Concatenate by sequence number.',
  },
  {
    title: 'Rotor Lock', category: 'Reverse', points: 600, room: 'premium', file: 'rotor_lock.py',
    flag: 'CA{r0t0r_l0ck_cr4ck3d}',
    description: 'A licence checker with a table-driven scrambler and a rolling key. Produce the licence key it accepts.',
    hint: 'The check is a bijection per position. Invert it byte by byte — each step only depends on the previous output.',
  },
];
