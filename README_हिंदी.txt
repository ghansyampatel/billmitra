=====================================================================
  BillMitra — GST Billing App  v1.0 (MVP)
=====================================================================
नाम बदलना हो: index.html (title), manifest.json (name, short_name), js/app.js (APP.name),
privacy.html — इन 4 जगह "BillMitra" बदल दें. Icon: icons/ folder की 3 PNG बदलें.

---------------------------------------------------------------------
 इसमें क्या है
---------------------------------------------------------------------
  • Business setup: नाम, GSTIN (checksum जाँच), state, पता, logo, UPI, bank, terms
  • Party master (GSTIN से state अपने आप) + opening balance
  • Item master (HSN/SAC, unit, rate GST से पहले, GST %)
  • बिल: Tax Invoice / Bill of Supply / Estimate
      - CGST+SGST या IGST अपने आप (आपका state बनाम Place of Supply)
      - सारे GST rate, छूट %, "rate में GST शामिल" का option, round off
      - नंबर financial year से: INV/26-27/001 (हर साल 001 से फिर)
      - नई पार्टी / नया आइटम लिखते ही master में जुड़ जाता है
      - Estimate → एक tap में Tax Invoice, Copy, Edit, Cancel (नंबर बचा रहता है)
  • Print: A4 GST invoice (amount in words, tax table, UPI QR) और 80mm thermal
      → Android पर Print → "Save as PDF" से PDF
  • WhatsApp पर बिल का सार + UPI pay link, बकाया की reminder
  • Payment entry, party ledger (खाता), बकाया 0-30 / 31-60 / 61-90 / 90+ दिन
  • Reports: बिक्री रजिस्टर, GST सारांश, GSTR-1 Excel (b2b, b2cl, b2cs, hsn, docs) — CA को भेजें
  • Backup / Restore (एक JSON file) · हिंदी / English · Offline चलता है

---------------------------------------------------------------------
 अभी की सीमाएँ (अगले version में)
---------------------------------------------------------------------
  • Data सिर्फ़ उसी phone में है → नियमित Backup ज़रूरी (Home पर याद दिलाता है).
    कई phone/PC पर एक साथ = Firebase cloud sync (अगला step — आपका Firebase project चाहिए).
  • Purchase / stock / credit note / e-way bill / e-invoice अभी नहीं.
  • Pro plan / payment (कमाई) अभी नहीं — cloud login के साथ जोड़ेंगे.
  • GSTR-1 file filing से पहले CA से ज़रूर जाँच करवाएँ.

---------------------------------------------------------------------
 STEP 1: Internet पर डालें (GitHub Pages — मुफ़्त)
---------------------------------------------------------------------
  1. github.com पर नई PUBLIC repository बनाएँ, जैसे: billmitra
  2. Add file → Upload files → इस folder की सारी files/folders डालें
     (.nojekyll file भी — यह ज़रूरी है)  → Commit
  3. Settings → Pages → Source: Deploy from a branch → main / (root) → Save
  4. 1-2 मिनट बाद link:  https://आपका-username.github.io/billmitra/
     Phone के Chrome में खोलें → ⋮ → "Add to Home screen" → app की तरह चलेगा

---------------------------------------------------------------------
 STEP 2: Play Store के लिए Android app (.aab) बनाएँ — PWABuilder (मुफ़्त)
---------------------------------------------------------------------
  1. https://www.pwabuilder.com खोलें → अपना GitHub Pages link डालें → Start
  2. "Package for stores" → Android → Generate
     Package ID: com.आपकानाम.billmitra (हमेशा के लिए, बाद में नहीं बदलता)
  3. एक zip मिलेगा: app-release-bundle.aab, signing.keystore, assetlinks.json, readme
     ⚠ signing.keystore + उसका password बहुत सँभालकर रखें — खोया तो app update नहीं होगा.
  4. assetlinks.json को repository में  .well-known/assetlinks.json  पर upload करें
     (इससे app में ऊपर browser bar नहीं दिखेगा)

---------------------------------------------------------------------
 STEP 3: Google Play Console
---------------------------------------------------------------------
  1. play.google.com/console → Developer account ($25 एक बार, ID verification)
     Business के नाम से (Organization, D-U-N-S नंबर) बनाएँ तो 12-tester वाला नियम नहीं लगता.
  2. Create app → नाम, भाषा, App (Free)
  3. ज़रूरी: Privacy policy URL = https://आपका-username.github.io/billmitra/privacy.html
     (privacy.html में अपना email डालें), Data safety form ("कोई data collect नहीं"),
     App category: Business, Content rating, screenshots (phone के 2-8), 512px icon (icons/icon-512.png)
  4. Personal account हो तो: Testing → Closed testing → कम से कम 12 testers, 14 दिन
  5. फिर Production → .aab upload → Review (कुछ दिन)

---------------------------------------------------------------------
 Update कैसे करें
---------------------------------------------------------------------
  Code बदलें → GitHub पर upload → sw.js में CACHE = 'billmitra-v1.0.1' जैसा नया नंबर.
  Play Store app अपने आप नया code ले लेता है (वह website ही खोलता है) — नया .aab सिर्फ़
  तब चाहिए जब icon / नाम / package बदलें.
