/* BillMitra — English / हिंदी */
(function (root) {
  const D = {
    home: ['Home', 'होम'], bills: ['Bills', 'बिल'], newBill: ['New Bill', 'नया बिल'], parties: ['Parties', 'पार्टी'],
    more: ['More', 'और'], items: ['Items', 'आइटम'], payments: ['Payments', 'पेमेंट'], reports: ['Reports', 'रिपोर्ट'],
    settings: ['Business Settings', 'बिज़नेस सेटिंग'], backup: ['Backup & Restore', 'बैकअप'], lang: ['Language', 'भाषा'],
    todaySale: ['Today\'s Sale', 'आज की बिक्री'], monthSale: ['This Month', 'इस महीने'], toReceive: ['To Receive', 'लेना बाकी'],
    billsMonth: ['Bills (month)', 'बिल (महीना)'], recent: ['Recent bills', 'हाल के बिल'],
    addParty: ['Add Party', 'पार्टी जोड़ें'], addItem: ['Add Item', 'आइटम जोड़ें'], addPayment: ['Receive Payment', 'पेमेंट लें'],
    save: ['Save', 'सेव करें'], cancel: ['Cancel', 'रद्द'], del: ['Delete', 'हटाएँ'], edit: ['Edit', 'बदलें'],
    search: ['Search…', 'खोजें…'], noData: ['Nothing here yet', 'अभी कुछ नहीं'],
    taxInvoice: ['Tax Invoice', 'टैक्स इनवॉइस'], bos: ['Bill of Supply', 'बिल ऑफ़ सप्लाई'], estimate: ['Estimate', 'एस्टिमेट'],
    party: ['Party', 'पार्टी'], date: ['Date', 'तारीख़'], billNo: ['Bill No.', 'बिल नंबर'], pos: ['Place of Supply', 'सप्लाई का राज्य'],
    item: ['Item', 'आइटम'], qty: ['Qty', 'मात्रा'], rate: ['Rate', 'रेट'], disc: ['Disc %', 'छूट %'], gst: ['GST %', 'GST %'],
    hsn: ['HSN/SAC', 'HSN/SAC'], unit: ['Unit', 'यूनिट'], addLine: ['+ Add item line', '+ आइटम जोड़ें'],
    inclusive: ['Rates include GST', 'रेट में GST शामिल'], notes: ['Notes', 'नोट'], total: ['Total', 'कुल'],
    taxable: ['Taxable', 'टैक्सेबल'], roundOff: ['Round off', 'राउंड ऑफ़'], receivedNow: ['Received now (₹)', 'अभी मिला (₹)'],
    mode: ['Mode', 'तरीका'], ledger: ['Ledger', 'खाता'], balance: ['Balance', 'बाकी'], whatsapp: ['WhatsApp', 'WhatsApp'],
    printA4: ['Print / PDF (A4)', 'प्रिंट / PDF (A4)'], print80: ['Print 80mm', 'प्रिंट 80mm'], reminder: ['Send Reminder', 'याद दिलाएँ'],
    cashSale: ['Cash sale (no party)', 'नकद बिक्री (बिना पार्टी)'], outstanding: ['Outstanding', 'बकाया'],
    salesReg: ['Sales Register', 'बिक्री रजिस्टर'], gstSum: ['GST Summary', 'GST सारांश'], gstr1: ['GSTR-1 Excel', 'GSTR-1 Excel'],
    from: ['From', 'से'], to: ['To', 'तक'], export: ['Download Excel', 'Excel डाउनलोड']
  };
  let lang = 'en';
  try { lang = localStorage.getItem('bm_lang') || 'en'; } catch (e) {}
  root.T = k => (D[k] ? D[k][lang === 'hi' ? 1 : 0] : k);
  root.I18N = {
    get lang() { return lang; },
    set(l) { lang = l; try { localStorage.setItem('bm_lang', l); } catch (e) {} document.documentElement.lang = l; },
    apply() { document.querySelectorAll('[data-t]').forEach(el => el.textContent = T(el.dataset.t)); }
  };
})(window);
