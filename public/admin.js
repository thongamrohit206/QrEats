const token = localStorage.getItem('token');
const shop = JSON.parse(localStorage.getItem('shop') || 'null');

if (!token || !shop) {
  window.location.href = '/login.html';
}

document.getElementById('shopNameLabel').textContent = `👋 ${shop.name}`;
document.getElementById('logoutBtn').addEventListener('click', () => {
  localStorage.clear();
  window.location.href = '/login.html';
});

const authHeaders = () => ({ Authorization: `Bearer ${token}` });

// ---------- Tabs ----------
document.querySelectorAll('.tabs button[data-tab]').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tabs button[data-tab]').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    const tab = btn.dataset.tab;
    document.getElementById('menuTab').style.display = tab === 'menu' ? 'block' : 'none';
    document.getElementById('ordersTab').style.display = tab === 'orders' ? 'block' : 'none';
    if (tab === 'orders') loadOrders();
  });
});

// ---------- Stats + QR ----------
async function loadProfile() {
  const res = await fetch('/api/shop/me', { headers: authHeaders() });
  const data = await res.json();
  if (!res.ok) return;

  document.getElementById('statGrid').innerHTML = `
    <div class="stat-card"><div class="num">${data.stats.itemCount}</div><div class="label">Menu Items</div></div>
    <div class="stat-card"><div class="num">${data.stats.orderCount}</div><div class="label">Total Orders</div></div>
    <div class="stat-card"><div class="num">${data.stats.pendingCount}</div><div class="label">Pending Orders</div></div>
  `;
}

async function loadQr() {
  const res = await fetch(`/api/auth/qrcode/${shop.id}`);
  const data = await res.json();
  if (!res.ok) return;
  document.getElementById('qrImage').src = data.qrCodeUrl;
  document.getElementById('downloadQr').href = data.qrCodeUrl;
  document.getElementById('menuUrl').textContent = data.menuUrl;
  document.getElementById('copyLinkBtn').onclick = () => {
    navigator.clipboard.writeText(data.menuUrl);
    alert('Menu link copied!');
  };
}

// ---------- Menu Items ----------
async function loadItems() {
  const res = await fetch('/api/items', { headers: authHeaders() });
  const data = await res.json();
  const grid = document.getElementById('itemsGrid');

  if (!data.items || data.items.length === 0) {
    grid.innerHTML = '<div class="empty-state">No menu items yet. Click "+ Add Item" to create your first one.</div>';
    return;
  }

  grid.innerHTML = data.items.map((item) => `
    <div class="item-card">
      ${item.photo_path ? `<img src="${item.photo_path}" alt="${item.name}">` : `<div class="no-img">No photo</div>`}
      <div class="body">
        <div class="name">${item.name} ${item.available ? '' : '<span class="badge cancelled">Hidden</span>'}</div>
        <div class="desc">${item.description || ''}</div>
        <div class="price">₹${Number(item.price).toFixed(2)} · ${item.category}</div>
        <div class="row-actions">
          <button class="btn btn-sm btn-outline" onclick="editItem('${item.id}')">Edit</button>
          <button class="btn btn-sm" onclick="toggleAvailable('${item.id}', ${item.available})">${item.available ? 'Hide' : 'Show'}</button>
          <button class="btn btn-sm btn-danger" onclick="deleteItem('${item.id}')">Delete</button>
        </div>
      </div>
    </div>
  `).join('');
}

let allItems = [];
async function refreshItemsCache() {
  const res = await fetch('/api/items', { headers: authHeaders() });
  const data = await res.json();
  allItems = data.items || [];
}

window.editItem = async (id) => {
  await refreshItemsCache();
  const item = allItems.find((i) => i.id === id);
  if (!item) return;
  document.getElementById('modalTitle').textContent = 'Edit Item';
  document.getElementById('itemId').value = item.id;
  document.getElementById('itemName').value = item.name;
  document.getElementById('itemDescription').value = item.description || '';
  document.getElementById('itemCategory').value = item.category;
  document.getElementById('itemPrice').value = item.price;
  document.getElementById('itemModal').style.display = 'flex';
};

window.toggleAvailable = async (id, current) => {
  const formData = new FormData();
  formData.append('available', current ? 0 : 1);
  await fetch(`/api/items/${id}`, { method: 'PUT', headers: authHeaders(), body: formData });
  loadItems();
};

window.deleteItem = async (id) => {
  if (!confirm('Delete this item permanently?')) return;
  await fetch(`/api/items/${id}`, { method: 'DELETE', headers: authHeaders() });
  loadItems();
  loadProfile();
};

document.getElementById('addItemBtn').addEventListener('click', () => {
  document.getElementById('modalTitle').textContent = 'Add Item';
  document.getElementById('itemForm').reset();
  document.getElementById('itemId').value = '';
  document.getElementById('itemCategory').value = 'General';
  document.getElementById('itemError').textContent = '';
  document.getElementById('itemModal').style.display = 'flex';
});

document.getElementById('cancelItemBtn').addEventListener('click', () => {
  document.getElementById('itemModal').style.display = 'none';
});

document.getElementById('itemForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = document.getElementById('itemId').value;
  const formData = new FormData();
  formData.append('name', document.getElementById('itemName').value);
  formData.append('description', document.getElementById('itemDescription').value);
  formData.append('category', document.getElementById('itemCategory').value);
  formData.append('price', document.getElementById('itemPrice').value);
  const photoFile = document.getElementById('itemPhoto').files[0];
  if (photoFile) formData.append('photo', photoFile);

  try {
    const url = id ? `/api/items/${id}` : '/api/items';
    const method = id ? 'PUT' : 'POST';
    const res = await fetch(url, { method, headers: authHeaders(), body: formData });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to save item');

    document.getElementById('itemModal').style.display = 'none';
    loadItems();
    loadProfile();
  } catch (err) {
    document.getElementById('itemError').textContent = err.message;
  }
});

// ---------- Orders ----------
let currentStatusFilter = '';
document.querySelectorAll('#orderStatusTabs button').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#orderStatusTabs button').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    currentStatusFilter = btn.dataset.status;
    loadOrders();
  });
});

document.getElementById('refreshOrdersBtn').addEventListener('click', loadOrders);

async function loadOrders() {
  const qs = currentStatusFilter ? `?status=${currentStatusFilter}` : '';
  const res = await fetch(`/api/orders${qs}`, { headers: authHeaders() });
  const data = await res.json();
  const list = document.getElementById('ordersList');

  if (!data.orders || data.orders.length === 0) {
    list.innerHTML = '<div class="empty-state">No orders found.</div>';
    return;
  }

  list.innerHTML = data.orders.map((order) => `
    <div class="card" style="margin-bottom:14px;">
      <div style="display:flex; justify-content:space-between; flex-wrap:wrap; gap:8px;">
        <div>
          <strong>Order #${order.id}</strong> ${order.table_no ? `· Table ${order.table_no}` : ''}
          <div style="color:var(--gray); font-size:0.85rem;">${new Date(order.created_at).toLocaleString()}</div>
          ${order.customer_name ? `<div style="font-size:0.85rem;">Customer: ${order.customer_name} ${order.customer_phone ? '· ' + order.customer_phone : ''}</div>` : ''}
        </div>
        <span class="badge ${order.status}">${order.status}</span>
      </div>
      <table style="margin-top:10px;">
        <thead><tr><th>Item</th><th>Qty</th><th>Price</th></tr></thead>
        <tbody>
          ${order.items.map((it) => `
  <tr>
    <td>${it.item_name}</td>
    <td>${it.qty}</td>
    <td>₹${Number(it.price).toFixed(2)}</td>
  </tr>
`).join('')}
        </tbody>
      </table>
      ${order.comments ? `<p style="margin-top:8px;"><strong>Note:</strong> ${order.comments}</p>` : ''}
      <div style="display:flex; justify-content:space-between; align-items:center; margin-top:10px;">
        <strong>
  Total: ₹${Number(order.total).toFixed(2)}
  <span style="color:var(--success); font-size:0.8rem;">
    (${order.payment_status})
  </span>
</strong>
        <div class="row-actions">
          ${renderStatusButtons(order)}
        </div>
      </div>
    </div>
  `).join('');
}

function renderStatusButtons(order) {
  const flow = ['placed', 'preparing', 'ready', 'delivered'];
  const idx = flow.indexOf(order.status);
  let buttons = '';
  if (idx >= 0 && idx < flow.length - 1) {
    const next = flow[idx + 1];
    buttons += `<button class="btn btn-sm btn-success" onclick="updateStatus('${order.id}','${next}')">Mark as ${next}</button>`;
  }
  if (order.status !== 'cancelled' && order.status !== 'delivered') {
    buttons += `<button class="btn btn-sm btn-danger" onclick="updateStatus('${order.id}','cancelled')">Cancel</button>`;
  }
  return buttons;
}

window.updateStatus = async (id, status) => {
  await fetch(`/api/orders/${id}/status`, {
    method: 'PUT',
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ status })
  });
  loadOrders();
  loadProfile();
};

// Auto-refresh orders every 15s while on orders tab
setInterval(() => {
  if (document.getElementById('ordersTab').style.display !== 'none') loadOrders();
}, 15000);

// ---------- Init ----------
loadProfile();
loadQr();
loadItems();
