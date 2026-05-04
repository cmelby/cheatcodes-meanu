const SHEET_URL = 'https://docs.google.com/spreadsheets/d/1WvO9yzQDyfnU9j7fdow5qPOuMcnj7Fp7HS3gz33DS7I/export?format=csv&gid=0';

let allPeptides = [];
let orderCart = {};

function updateOrderTotal() {
    let total = 0;
    for (let key in orderCart) {
        total += orderCart[key].qty * orderCart[key].price;
    }
    document.getElementById('orderTotal').innerText = '$' + total.toFixed(2);
}

document.addEventListener('DOMContentLoaded', () => {
    fetchData();

    document.getElementById('searchInput').addEventListener('input', (e) => {
        renderGrid(e.target.value);
    });
});

async function fetchData() {
    try {
        const response = await fetch(SHEET_URL);
        const csvText = await response.text();
        
        Papa.parse(csvText, {
            header: true,
            skipEmptyLines: true,
            complete: function(results) {
                const validRows = results.data.filter(row => row['Peptide Name'] && row['Price (USD)']);
                
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
                    
                    let rawPrice = row['Price (USD)'].trim();
                    if (!rawPrice.startsWith('$')) {
                        rawPrice = '$' + rawPrice;
                    }

                    grouped[name].variants.push({
                        boxPackage: boxPackage,
                        dosageExtract: dosageExtract,
                        price: rawPrice
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
                orderCart[cartKey] = { price: priceNum, qty: 0 };
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
