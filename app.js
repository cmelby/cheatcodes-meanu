const SHEET_URL = 'https://docs.google.com/spreadsheets/d/1WvO9yzQDyfnU9j7fdow5qPOuMcnj7Fp7HS3gz33DS7I/export?format=csv&gid=0';

let allPeptides = [];

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
                // Filter out rows that don't have a valid name or price
                allPeptides = results.data.filter(row => row['Peptide Name'] && row['Price (USD)']);
                document.getElementById('loading').style.display = 'none';
                renderGrid();
            },
            error: function(error) {
                console.error("Error parsing CSV:", error);
                document.getElementById('loading').innerHTML = '<p style="color: red;">Error loading menu data. Please try again later.</p>';
            }
        });
    } catch (error) {
        console.error("Error fetching data:", error);
        document.getElementById('loading').innerHTML = '<p style="color: red;">Error loading menu data. Please try again later.</p>';
    }
}

function renderGrid(searchTerm = '') {
    const grid = document.getElementById('productGrid');
    grid.innerHTML = '';

    const filtered = allPeptides.filter(p => {
        const name = (p['Peptide Name'] || '').toLowerCase();
        const dosage = (p['Box Package'] || '').toLowerCase();
        const term = searchTerm.toLowerCase();
        return name.includes(term) || dosage.includes(term);
    });

    if (filtered.length === 0) {
        grid.innerHTML = '<p style="text-align:center; grid-column: 1/-1; color: var(--text-muted);">No peptides found matching your search.</p>';
        return;
    }

    filtered.forEach(peptide => {
        const name = peptide['Peptide Name'];
        const boxPackage = peptide['Box Package'];
        
        // Extract dosage for the vial image (e.g., "5mg*10vials" -> "5mg")
        let dosageExtract = boxPackage.split('*')[0] || boxPackage;
        // Clean up some common text if present, to just show mg/mcg
        dosageExtract = dosageExtract.replace(/\s/g, ''); 

        // Price formatting
        let rawPrice = peptide['Price (USD)'];
        if (!rawPrice.startsWith('$')) {
            rawPrice = '$' + rawPrice;
        }

        const card = document.createElement('div');
        card.className = 'product-card';
        
        card.innerHTML = `
            <div class="vial-container">
                <img src="assets/blank-vial.png" alt="${name} vial" class="vial-image" loading="lazy">
                <div class="vial-overlay">
                    <div class="overlay-name">${truncateName(name)}</div>
                    <div class="overlay-dosage">${dosageExtract}</div>
                </div>
            </div>
            <div class="product-info">
                <h3 class="product-name">${name}</h3>
                <p class="product-dosage">${boxPackage}</p>
                <p class="product-price">${rawPrice} <span class="price-label">/ 10 vials</span></p>
            </div>
        `;
        
        grid.appendChild(card);
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
