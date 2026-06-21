const params = new URLSearchParams(window.location.search);
const shopId = params.get('shop');
const tablePrefill = params.get('table');

if (!shopId) {
  document.body.innerHTML =
    '<div class="container"><div class="empty-state">⚠️ Invalid menu link. Please scan the QR code again.</div></div>';
  throw new Error('No shop id');
}

let cart = {};
let shopInfo = null;

async function loadMenu() {
  try {
    const res = await fetch(`/api/items/public/${shopId}`);
    const data = await res.json();

    if (!res.ok) {
      document.body.innerHTML = `
        <div class="container">
          <div class="empty-state">
            ⚠️ ${data.error || 'Shop not found'}
          </div>
        </div>
      `;
      return;
    }

    shopInfo = data.shop;

    document.getElementById('shopName').innerHTML =
      `🍽️ ${shopInfo.name}`;

    document.title = `${shopInfo.name} - Menu`;

    if (tablePrefill) {
      document.getElementById('tableNo').value = tablePrefill;
    }

    if (!data.items || data.items.length === 0) {
      document.getElementById('categoriesContainer').innerHTML =
        '<div class="empty-state">No items available right now.</div>';
      return;
    }

    // Group by category
    const grouped = {};

    data.items.forEach((item) => {
      const category = item.category || 'General';

      if (!grouped[category]) {
        grouped[category] = [];
      }

      grouped[category].push(item);
    });

    const container = document.getElementById('categoriesContainer');

    container.innerHTML = Object.entries(grouped)
      .map(([category, items]) => `
        <h3 style="margin-top:24px;">${category}</h3>

        <div class="grid">
          ${items.map((item) => `
            <div class="item-card">

              ${
                item.photo_path
                  ? `<img src="${item.photo_path}"
                         alt="${item.name}"
                         onerror="this.style.display='none'">`
                  : `<div class="no-img">No Photo</div>`
              }

              <div class="body">

                <div class="name">
                  ${item.name}
                </div>

                <div class="desc">
                  ${item.description || ''}
                </div>

                <div class="price">
                  ₹${Number(item.price).toFixed(2)}
                </div>

                <div id="qty-area-${item.id}"></div>

              </div>
            </div>
          `).join('')}
        </div>
      `)
      .join('');

    data.items.forEach(item => {
      renderQtyControl(item);
    });

  } catch (err) {
    console.error(err);

    document.getElementById('categoriesContainer').innerHTML =
      '<div class="empty-state">Failed to load menu.</div>';
  }
}

function renderQtyControl(item) {
  const area = document.getElementById(
    `qty-area-${item.id}`
  );

  const qty = cart[item.id]
    ? cart[item.id].qty
    : 0;

  if (qty === 0) {
    area.innerHTML = `
      <button
        class="btn btn-block"
        onclick="addToCart(
          '${item.id}',
          '${item.name.replace(/'/g, "\\'")}',
          ${Number(item.price)}
        )">
        Add to Cart
      </button>
    `;
  } else {
    area.innerHTML = `
      <div class="qty-control">
        <button onclick="changeQty('${item.id}', -1)">
          -
        </button>

        <span>${qty}</span>

        <button onclick="changeQty('${item.id}', 1)">
          +
        </button>
      </div>
    `;
  }
}

window.addToCart = (id, name, price) => {
  price = Number(price);

  cart[id] = {
    name,
    price,
    qty: 1
  };

  renderQtyControl({
    id,
    name,
    price
  });

  updateCartBar();
};

window.changeQty = (id, delta) => {
  if (!cart[id]) return;

  cart[id].qty += delta;

  if (cart[id].qty <= 0) {
    delete cart[id];
  }

  renderQtyControl({
    id,
    name: '',
    price: 0
  });

  updateCartBar();
};

function updateCartBar() {
  const items = Object.values(cart);

  const count =
    items.reduce((s, i) => s + i.qty, 0);

  const total =
    items.reduce(
      (s, i) => s + i.qty * i.price,
      0
    );

  const cartBar =
    document.getElementById('cartBar');

  if (count === 0) {
    cartBar.style.display = 'none';
  } else {
    cartBar.style.display = 'flex';

    document.getElementById(
      'cartCount'
    ).textContent = count;

    document.getElementById(
      'cartTotal'
    ).textContent =
      total.toFixed(2);
  }
}

document
  .getElementById('viewCartBtn')
  .addEventListener('click', () => {
    renderCartModal();
    document.getElementById(
      'cartModal'
    ).style.display = 'flex';
  });

document
  .getElementById('closeCartBtn')
  .addEventListener('click', () => {
    document.getElementById(
      'cartModal'
    ).style.display = 'none';
  });

function renderCartModal() {
  const items =
    Object.entries(cart);

  const total =
    items.reduce(
      (s, [, i]) =>
        s + i.qty * i.price,
      0
    );

  document.getElementById(
    'cartItemsList'
  ).innerHTML =
    items.map(([id, i]) => `
      <div style="
        display:flex;
        justify-content:space-between;
        margin-bottom:8px;
      ">
        <span>
          ${i.name} × ${i.qty}
        </span>

        <span>
          ₹${(i.qty * i.price).toFixed(2)}
        </span>
      </div>
    `).join('') ||
    '<p>Your cart is empty.</p>';

  document.getElementById(
    'modalTotal'
  ).textContent =
    total.toFixed(2);
}

document
  .getElementById('placeOrderBtn')
  .addEventListener('click', async () => {

    const errorEl =
      document.getElementById(
        'checkoutError'
      );

    errorEl.textContent = '';

    const items =
      Object.entries(cart)
        .map(([itemId, i]) => ({
          itemId,
          name: i.name,
          price: i.price,
          qty: i.qty
        }));

    if (items.length === 0) {
      errorEl.textContent =
        'Your cart is empty.';
      return;
    }

    const payload = {
      shopId,
      tableNo:
        document.getElementById(
          'tableNo'
        ).value,

      customerName:
        document.getElementById(
          'customerName'
        ).value,

      customerPhone:
        document.getElementById(
          'customerPhone'
        ).value,

      comments:
        document.getElementById(
          'comments'
        ).value,

      paymentMethod:
        document.getElementById(
          'paymentMethod'
        ).value,

      items
    };

    try {
      const button =
        document.getElementById(
          'placeOrderBtn'
        );

      button.disabled = true;
      button.textContent =
        'Processing...';

      const res =
        await fetch('/api/orders', {
          method: 'POST',
          headers: {
            'Content-Type':
              'application/json'
          },
          body:
            JSON.stringify(payload)
        });

      const data =
        await res.json();

      if (!res.ok) {
        throw new Error(
          data.error ||
          'Failed to place order'
        );
      }

      cart = {};

      updateCartBar();

      window.location.href =
        `/order-status.html?orderId=${data.orderId}`;

    } catch (err) {
      errorEl.textContent =
        err.message;

      const button =
        document.getElementById(
          'placeOrderBtn'
        );

      button.disabled = false;
      button.textContent =
        'Pay & Place Order';
    }
});

loadMenu();