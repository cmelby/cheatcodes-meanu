const SHEET_URL = 'https://docs.google.com/spreadsheets/d/1iZFoD9eG1Rou-4wSUlFllTyE2ZzM_rS27kFMfuE3CDM/export?format=csv&gid=1354480122';

let allPeptides = [];
let orderCart = {};

function updateOrderTotal() {
    let total = 0;
    const previewContainer = document.getElementById('cartPreview');
    previewContainer.innerHTML = '';
    
    for (let key in orderCart) {
        const item = orderCart[key];
        total += item.qty * item.price;
        
        const parts = key.split('|');
        const displayName = parts[0] + ' ' + (parts[1] || '');
        
        const pill = document.createElement('span');
        pill.className = 'cart-pill';
        pill.innerHTML = `${displayName} <b>x${item.qty}</b>`;
        previewContainer.appendChild(pill);
    }
    document.getElementById('orderTotal').innerText = '$' + total.toFixed(2);
    
    const checkoutBtn = document.getElementById('checkoutBtn');
    if (checkoutBtn) {
        if (Object.keys(orderCart).length > 0) {
            checkoutBtn.disabled = false;
        } else {
            checkoutBtn.disabled = true;
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    fetchData();

    document.getElementById('searchInput').addEventListener('input', (e) => {
        renderGrid(e.target.value);
    });

    // Modal elements
    const checkoutBtn = document.getElementById('checkoutBtn');
    const checkoutModal = document.getElementById('checkoutModal');
    const invoiceModal = document.getElementById('invoiceModal');
    const cancelCheckoutBtn = document.getElementById('cancelCheckoutBtn');
    const generateInvoiceBtn = document.getElementById('generateInvoiceBtn');
    const closeInvoiceBtn = document.getElementById('closeInvoiceBtn');
    const confirmOrderBtn = document.getElementById('confirmOrderBtn');

    if (checkoutBtn) {
        checkoutBtn.addEventListener('click', () => {
            if (Object.keys(orderCart).length > 0) {
                checkoutModal.classList.remove('hidden');
            }
        });
    }

    if (cancelCheckoutBtn) cancelCheckoutBtn.addEventListener('click', () => checkoutModal.classList.add('hidden'));
    if (closeInvoiceBtn) closeInvoiceBtn.addEventListener('click', () => invoiceModal.classList.add('hidden'));

    if (generateInvoiceBtn) {
        generateInvoiceBtn.addEventListener('click', () => {
            const name = document.getElementById('custName').value;
            const email = document.getElementById('custEmail').value;
            const company = document.getElementById('custCompany').value;
            const address = document.getElementById('custAddress').value.replace(/\n/g, '<br>');

            if (!name || !email || !address) {
                alert('Please fill out Name, Email, and Address.');
                return;
            }

            checkoutModal.classList.add('hidden');
            buildInvoiceHTML(name, email, company, address);
            invoiceModal.classList.remove('hidden');
        });
    }

    if (confirmOrderBtn) {
        confirmOrderBtn.addEventListener('click', async () => {
            const email = document.getElementById('custEmail').value;
            const invoiceHtml = document.getElementById('invoiceHTML').innerHTML;
            const statusEl = document.getElementById('invoiceStatus');

            confirmOrderBtn.disabled = true;
            confirmOrderBtn.innerText = "Generating PDF...";
            statusEl.innerText = "Generating secure PDF Invoice...";
            statusEl.style.color = "var(--accent-blue)";

            try {
                const element = document.getElementById('invoiceHTML');
                
                // Create an off-screen clone guaranteed to have no clipping from parent modals
                const clone = element.cloneNode(true);
                clone.style.position = 'absolute';
                clone.style.top = '-9999px';
                clone.style.left = '-9999px';
                clone.style.width = '900px'; // Fixed desktop width
                clone.style.maxHeight = 'none';
                clone.style.overflow = 'visible';
                document.body.appendChild(clone);

                const opt = {
                  margin:       0.2,
                  filename:     'CheatCodes_Invoice.pdf',
                  image:        { type: 'jpeg', quality: 0.98 },
                  html2canvas:  { scale: 2, backgroundColor: '#000000', windowWidth: 900 },
                  jsPDF:        { unit: 'in', format: 'letter', orientation: 'portrait' }
                };

                const pdfBase64 = await html2pdf().set(opt).from(clone).outputPdf('datauristring');
                
                // Remove the clone after generating PDF
                document.body.removeChild(clone);
                
                statusEl.innerText = "Sending Email...";

                const res = await fetch('/api/send-invoice', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ customerEmail: email, invoiceHtml, pdfBase64 })
                });

                const data = await res.json();
                if (res.ok) {
                    statusEl.innerText = "Invoice sent successfully! Check your email.";
                    statusEl.style.color = "var(--accent-blue)";
                    orderCart = {}; // clear cart
                    updateOrderTotal(); // reset UI
                    setTimeout(() => {
                        invoiceModal.classList.add('hidden');
                        confirmOrderBtn.disabled = false;
                        confirmOrderBtn.innerText = "Confirm & Send Order";
                        statusEl.innerText = "";
                        document.querySelectorAll('.qty-val').forEach(el => el.innerText = "0");
                        document.getElementById('cartPreview').innerHTML = '';
                    }, 3000);
                } else {
                    statusEl.innerText = "Error: " + data.error;
                    statusEl.style.color = "red";
                    confirmOrderBtn.disabled = false;
                    confirmOrderBtn.innerText = "Confirm & Send Order";
                }
            } catch (err) {
                statusEl.innerText = "Failed to communicate with server.";
                statusEl.style.color = "red";
                confirmOrderBtn.disabled = false;
                confirmOrderBtn.innerText = "Confirm & Send Order";
            }
        });
    }
});

function buildInvoiceHTML(name, email, company, address) {
    let rowsHtml = '';
    let subtotal = 0;

    for (let key in orderCart) {
        const item = orderCart[key];
        const parts = key.split('|');
        const pepName = parts[0] + ' ' + (parts[1] || '');
        
        const pricePerKit = item.price;
        const volumeInKits = item.qty;
        const volumeInVials = volumeInKits * 10;
        const pricePerVial = pricePerKit / 10;
        const rowTotal = pricePerKit * volumeInKits;
        subtotal += rowTotal;

        rowsHtml += `
            <tr>
                <td>${item.code || ''}</td>
                <td>${item.sheetRow || ''}</td>
                <td>${pepName}</td>
                <td>${volumeInVials}</td>
                <td>${volumeInKits}</td>
                <td class="text-right">${pricePerVial.toFixed(2)}</td>
                <td class="text-right">${pricePerKit.toFixed(2)}</td>
                <td class="text-right">${rowTotal.toFixed(2)}</td>
            </tr>
        `;
    }

    const html = `
        <div class="invoice-template">
            <div class="inv-header">
                <div class="inv-logo">
                    <img src="assets/logo.png" alt="Cheat Codes Logo" style="height:40px; margin-bottom:5px;">
                    <div style="font-size:0.75rem; letter-spacing:1px; color:#aaa;">PEPTIDES | CHEATCODESPEPTIDES.COM</div>
                </div>
                <div class="inv-title">INVOICE</div>
            </div>
            
            <div class="inv-meta">
                <div class="inv-section">
                    <h4>BILL TO / SHIP TO</h4>
                    <p><strong>${name}</strong></p>
                    ${company ? `<p>${company}</p>` : ''}
                    <p>${address}</p>
                    <p>${email}</p>
                </div>
                <div class="inv-section">
                    <h4>PAYMENT INSTRUCTIONS</h4>
                    <p><strong>Company Name:</strong> CHEAT CODES INC</p>
                    <p><strong>Bank:</strong> JP Morgan Chase</p>
                    <p><strong>Account:</strong> 2907088392</p>
                    <p><strong>Routing:</strong> 021000021</p>
                    <p><strong>Address:</strong> 396 Sampson, Kyle, TX 78640</p>
                </div>
            </div>

            <table class="inv-table">
                <thead>
                    <tr>
                        <th>CODE</th>
                        <th>ROW #</th>
                        <th>PEP</th>
                        <th>VOLUME IN VIALS</th>
                        <th>VOLUME IN KITS</th>
                        <th class="text-right">PRICE PER</th>
                        <th class="text-right">PRICE PER KIT</th>
                        <th class="text-right">TOTAL</th>
                    </tr>
                </thead>
                <tbody>
                    ${rowsHtml}
                </tbody>
            </table>

            <div class="inv-totals-box">
                <div class="inv-totals-row">
                    <span>Subtotal:</span>
                    <span>$${subtotal.toFixed(2)}</span>
                </div>
                <div class="inv-totals-row">
                    <span>Shipping:</span>
                    <span>$0.00</span>
                </div>
                <div class="inv-totals-row total">
                    <span>Total:</span>
                    <span>$${subtotal.toFixed(2)}</span>
                </div>
            </div>

            <div class="inv-footer">
                MOVE BEYOND BIOLOGY
            </div>
        </div>
    `;

    document.getElementById('invoiceHTML').innerHTML = html;
}

async function fetchData() {
    try {
        const response = await fetch(SHEET_URL);
        const csvText = await response.text();
        
        Papa.parse(csvText, {
            header: true,
            skipEmptyLines: true,
            complete: function(results) {
                const rowsWithNumbers = results.data.map((row, i) => ({
                    ...row,
                    _originalRow: i + 2 // +1 for 1-based index, +1 for header row
                }));
                const validRows = rowsWithNumbers.filter(row => row['Peptide Name'] && row['Price (USD)']);
                
                const grouped = {};
                validRows.forEach(row => {
                    const name = row['Peptide Name'].trim();
                    if (!grouped[name]) {
                        grouped[name] = {
                            name: name,
                            variants: []
                        };
                    }
                    
                    let boxPackage = row['Box Package'];
                    let dosageExtract = boxPackage.split('*')[0] || boxPackage;
                    dosageExtract = dosageExtract.replace(/\s/g, ''); 
                    
                    let rawPriceStr = row['Price (USD)'].trim();
                    let numericPrice = parseFloat(rawPriceStr.replace(/[^0-9.]/g, ''));
                    let markedUpPrice = numericPrice * 1.5;
                    let displayPrice = '$' + markedUpPrice.toFixed(2);

                    grouped[name].variants.push({
                        boxPackage: boxPackage,
                        dosageExtract: dosageExtract,
                        price: displayPrice,
                        code: row['Code'] ? row['Code'].trim() : '',
                        sheetRow: row._originalRow
                    });
                });
                
                allPeptides = Object.values(grouped);
                
                document.getElementById('loading').style.display = 'none';
                renderGrid();
            },
        });
    } catch (error) {
        console.error("Error fetching data:", error);
        document.getElementById('loading').innerHTML = '<p style="color: red;">Error loading menu data. Please try again later.</p>';
    }
}

function renderGrid(searchTerm = '') {
    const grid = document.getElementById('productGrid');
    grid.innerHTML = '';

    const term = searchTerm.toLowerCase();
    const filtered = allPeptides.filter(p => {
        const name = p.name.toLowerCase();
        const hasVariantMatch = p.variants.some(v => v.boxPackage.toLowerCase().includes(term));
        return name.includes(term) || hasVariantMatch;
    });

    if (filtered.length === 0) {
        grid.innerHTML = '<p style="text-align:center; grid-column: 1/-1; color: var(--text-muted);">No peptides found matching your search.</p>';
        return;
    }

    filtered.forEach((peptide, index) => {
        const card = document.createElement('div');
        card.className = 'product-card';
        
        let variantHtml = '<div class="variant-selector">';
        peptide.variants.forEach((v, vIndex) => {
            const activeClass = vIndex === 0 ? 'active' : '';
            variantHtml += `<button class="variant-btn ${activeClass}" data-card-id="${index}" data-variant-index="${vIndex}">${v.dosageExtract}</button>`;
        });
        variantHtml += '</div>';

        const defaultVariant = peptide.variants[0];

        card.innerHTML = `
            <div class="vial-container">
                <img src="assets/blank-vial.png" alt="${peptide.name} vial" class="vial-image" loading="lazy">
                <div class="vial-overlay">
                    <div class="overlay-name" id="overlay-name-${index}">${truncateName(peptide.name)}</div>
                    <div class="overlay-dosage" id="overlay-dosage-${index}">${defaultVariant.dosageExtract}</div>
                </div>
            </div>
            <div class="product-info">
                <h3 class="product-name">${peptide.name}</h3>
                ${variantHtml}
                <p class="product-price" id="price-${index}">${defaultVariant.price} <span class="price-label">/ 10 vials</span></p>
                <div class="order-controls">
                    <div class="qty-selector">
                        <button class="qty-btn minus" data-card-id="${index}">-</button>
                        <div class="qty-val" id="qty-${index}">0</div>
                        <button class="qty-btn plus" data-card-id="${index}">+</button>
                    </div>
                </div>
            </div>
        `;
        
        grid.appendChild(card);
    });

    document.querySelectorAll('.variant-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const cardId = e.target.getAttribute('data-card-id');
            const variantIndex = e.target.getAttribute('data-variant-index');
            
            const parent = e.target.parentElement;
            parent.querySelectorAll('.variant-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            
            const peptide = filtered[cardId];
            const variant = peptide.variants[variantIndex];
            
            document.getElementById(`overlay-dosage-${cardId}`).innerText = variant.dosageExtract;
            document.getElementById(`price-${cardId}`).innerHTML = `${variant.price} <span class="price-label">/ 10 vials</span>`;
            
            const cartKey = peptide.name + '|' + variant.boxPackage;
            const currentQty = orderCart[cartKey] ? orderCart[cartKey].qty : 0;
            document.getElementById(`qty-${cardId}`).innerText = currentQty;
        });
    });

    document.querySelectorAll('.qty-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const cardId = e.target.getAttribute('data-card-id');
            const isPlus = e.target.classList.contains('plus');
            
            const cardEl = e.target.closest('.product-card');
            const activeVariantBtn = cardEl.querySelector('.variant-btn.active');
            const variantIndex = activeVariantBtn.getAttribute('data-variant-index');
            
            const peptide = filtered[cardId];
            const variant = peptide.variants[variantIndex];
            const cartKey = peptide.name + '|' + variant.boxPackage;
            
            const priceNum = parseFloat(variant.price.replace('$', '').replace(',', ''));
            
            if (!orderCart[cartKey]) {
                orderCart[cartKey] = { 
                    price: priceNum, 
                    qty: 0,
                    code: variant.code,
                    sheetRow: variant.sheetRow
                };
            }
            
            if (isPlus) {
                orderCart[cartKey].qty += 1;
            } else {
                if (orderCart[cartKey].qty > 0) {
                    orderCart[cartKey].qty -= 1;
                }
            }
            
            if (orderCart[cartKey].qty === 0) {
                delete orderCart[cartKey];
            }
            
            const currentQty = orderCart[cartKey] ? orderCart[cartKey].qty : 0;
            document.getElementById(`qty-${cardId}`).innerText = currentQty;
            
            updateOrderTotal();
        });
    });
}

// Truncate name if it's too long to fit on the vial nicely
function truncateName(name) {
    // If name has parentheses, let's remove them for the vial display to keep it clean
    let cleanName = name.replace(/\([^)]*\)/g, '').trim();
    if (cleanName.length > 18) {
        return cleanName.substring(0, 16) + '...';
    }
    return cleanName;
}
