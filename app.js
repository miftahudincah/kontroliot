// ====== Konfigurasi Firebase ======
const firebaseConfig = {
  databaseURL: "https://teslo-88f6e-default-rtdb.firebaseio.com/"
};
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// ====== State ======
let currentUserKey = localStorage.getItem('currentUserKey');
let currentUserRole = localStorage.getItem('currentUserRole');
let currentUserName = ''; // simpan nama user untuk history

// ====== Element ======
const registerPage = document.getElementById('registerPage');
const loginPage = document.getElementById('loginPage');
const dashboard = document.getElementById('dashboard');

const registerBtn = document.getElementById('registerBtn');
const loginBtn = document.getElementById('loginBtn');
const logoutBtn = document.getElementById('logoutBtn');
const toLogin = document.getElementById('toLogin');
const toRegister = document.getElementById('toRegister');
const relayBtn = document.getElementById('relayBtn');
const lockBtn = document.getElementById('lockBtn');
const lockIndicator = document.getElementById('lockIndicator'); // indikator lock

// ====== Event Toggle Halaman ======
toLogin.addEventListener('click', togglePage);
toRegister.addEventListener('click', togglePage);

function togglePage() {
  loginPage.style.display = loginPage.style.display === 'none' ? 'block' : 'none';
  registerPage.style.display = registerPage.style.display === 'none' ? 'block' : 'none';
}

// ====== Cek Login Persistent ======
if (currentUserKey) {
  db.ref('users/' + currentUserKey).once('value', snap => {
    const data = snap.val();
    if (data) {
      currentUserRole = data.role;
      currentUserName = data.name;
      localStorage.setItem('currentUserRole', currentUserRole);
      showDashboard();
    } else {
      localStorage.removeItem('currentUserKey');
      localStorage.removeItem('currentUserRole');
    }
  });
}

// ====== Register ======
registerBtn.addEventListener('click', () => {
  const name = document.getElementById('regName').value.trim();
  const email = document.getElementById('regEmail').value.trim();
  const password = document.getElementById('regPassword').value.trim();

  if (!name || !email || !password) {
    alert('Semua field harus diisi!');
    return;
  }

  db.ref('users').orderByChild('email').equalTo(email).once('value', snapshot => {
    if (snapshot.exists()) {
      alert('Email sudah terdaftar!');
    } else {
      const userId = db.ref('users').push().key;
      db.ref('users/' + userId).set({
        name,
        email,
        password,
        role: 'user' // Role default
      });
      alert('Registrasi berhasil!');
      togglePage();
    }
  });
});

// ====== Login ======
loginBtn.addEventListener('click', () => {
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value.trim();

  if (!email || !password) {
    alert('Email dan Password harus diisi!');
    return;
  }

  db.ref('users').orderByChild('email').equalTo(email).once('value', snapshot => {
    if (snapshot.exists()) {
      const userData = snapshot.val();
      currentUserKey = Object.keys(userData)[0];
      currentUserRole = userData[currentUserKey].role;
      currentUserName = userData[currentUserKey].name;

      if (userData[currentUserKey].password === password) {
        localStorage.setItem('currentUserKey', currentUserKey);
        localStorage.setItem('currentUserRole', currentUserRole);
        showDashboard();
      } else {
        alert('Password salah!');
      }
    } else {
      alert('Email tidak terdaftar!');
    }
  });
});

// ====== Tampilkan Dashboard ======
function showDashboard() {
  loginPage.style.display = 'none';
  registerPage.style.display = 'none';
  dashboard.style.display = 'block';
  initRelay();

  if (currentUserRole === 'admin') {
    lockBtn.style.display = 'block';
  } else {
    lockBtn.style.display = 'none';
  }
}

// ====== Logout ======
logoutBtn.addEventListener('click', () => {
  currentUserKey = null;
  currentUserRole = null;
  currentUserName = '';
  localStorage.removeItem('currentUserKey');
  localStorage.removeItem('currentUserRole');
  dashboard.style.display = 'none';
  loginPage.style.display = 'block';
});

// ====== Inisialisasi Relay ======
function initRelay() {
  const relayRef = db.ref('relay/status');
  const lockRef = db.ref('relay/lock');
  const historyRef = db.ref('relay/history');

  // Listen status relay
  relayRef.on('value', snap => {
    const status = snap.val() || 'off';
    updateRelayUI(status);
  });

  // Listen status lock
  lockRef.on('value', snap => {
    const lockStatus = snap.val() || 'off';
    updateLockUI(lockStatus);
  });

  // Listen history terakhir
  historyRef.on('value', snap => {
    const lastUser = snap.val() || 'Tidak ada';
    document.getElementById('status').textContent = `Status terakhir: ${lastUser}`;
  });
}

// ====== Update UI Relay ======
function updateRelayUI(status) {
  relayBtn.textContent = status === 'on' ? ' matikan pompa air ' : ' hidupkan pompa air';
}

// ====== Update UI Lock ======
function updateLockUI(lockStatus) {
  if (lockStatus === 'on') {
    lockIndicator.textContent = 'Lock: ON (Relay terkunci oleh Admin)';
    lockIndicator.style.color = 'red';
  } else {
    lockIndicator.textContent = 'Lock: OFF (Relay bisa digunakan)';
    lockIndicator.style.color = 'green';
  }

  if (currentUserRole !== 'admin') {
    relayBtn.disabled = lockStatus === 'on';
  }

  lockBtn.textContent = lockStatus === 'on' ? 'Unlock Relay' : 'Lock Relay';
}

// ====== Toggle Relay ======
relayBtn.addEventListener('click', () => {
  const lockRef = db.ref('relay/lock');
  lockRef.once('value', snap => {
    if (snap.val() === 'on' && currentUserRole !== 'admin') {
      alert('Relay terkunci oleh admin!');
      return;
    } else {
      toggleRelayStatus();
    }
  });
});

function toggleRelayStatus() {
  const relayRef = db.ref('relay/status');
  const historyRef = db.ref('relay/history');
  relayRef.once('value', snap => {
    const status = snap.val() || 'off';
    const newStatus = status === 'on' ? 'off' : 'on';
    relayRef.set(newStatus);
    historyRef.set(`${currentUserName} menekan ${newStatus.toUpperCase()}`);
  });
}

// ====== Toggle Lock (Admin Only) ======
lockBtn.addEventListener('click', () => {
  if (currentUserRole !== 'admin') return;
  const lockRef = db.ref('relay/lock');
  lockRef.once('value', snap => {
    const lockStatus = snap.val() || 'off';
    const newLockStatus = lockStatus === 'on' ? 'off' : 'on';
    lockRef.set(newLockStatus);
  });
});
