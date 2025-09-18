// ====== Konfigurasi Firebase ======
const firebaseConfig = {
  databaseURL: "https://teslo-88f6e-default-rtdb.firebaseio.com/"
};
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// ====== State ======
let currentUserKey = localStorage.getItem('currentUserKey');
let currentUserRole = localStorage.getItem('currentUserRole');
let currentUserName = '';

// ====== Element ======
const registerPage = document.getElementById('registerPage');
const loginPage = document.getElementById('loginPage');
const dashboard = document.getElementById('dashboard');
const chatPage = document.getElementById('chatPage');
const chatPageBtn = document.getElementById('chatPageBtn');

const registerBtn = document.getElementById('registerBtn');
const loginBtn = document.getElementById('loginBtn');
const logoutBtn = document.getElementById('logoutBtn');
const toLogin = document.getElementById('toLogin');
const toRegister = document.getElementById('toRegister');
const relayBtn = document.getElementById('relayBtn');
const lockBtn = document.getElementById('lockBtn');
const lockIndicator = document.getElementById('lockIndicator');
const voiceBtn = document.getElementById('voiceBtn');

// ====== Toggle Halaman Login/Register ======
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

      validateUserName(currentUserName, isValid => {
        if (isValid) showDashboard();
        else promptNameInput();
      });
    } else {
      localStorage.clear();
      showLogin();
    }
  });
} else {
  showLogin();
}

// ====== Fungsi Validasi Nama (harus ada di validNames & unik) ======
function validateUserName(name, callback) {
  const lowerName = name.toLowerCase();

  // 1. Cek ada di validNames
  db.ref('validNames').orderByKey().once('value', snapshot => {
    let inValidNames = false;
    snapshot.forEach(child => {
      if (child.key.toLowerCase() === lowerName) inValidNames = true;
    });

    if (!inValidNames) {
      callback(false); // Nama tidak ada di validNames
      return;
    }

    // 2. Cek unik di users
    db.ref('users').once('value', snapUsers => {
      let exists = false;
      snapUsers.forEach(child => {
        const childName = child.val().name || '';
        if (childName.toLowerCase() === lowerName && child.key !== currentUserKey) {
          exists = true; // Nama sudah dipakai user lain
        }
      });

      callback(!exists); // true = valid, false = bentrok
    });
  });
}

// ====== Register ======
registerBtn.addEventListener('click', () => {
  const name = document.getElementById('regName').value.trim();
  const email = document.getElementById('regEmail').value.trim().toLowerCase();
  const password = document.getElementById('regPassword').value.trim();

  if (!name || !email || !password) {
    alert('Semua field harus diisi!');
    return;
  }

  validateUserName(name, isValid => {
    if (!isValid) {
      alert('Nama tidak valid atau sudah digunakan! Silakan ganti.');
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
          role: 'user'
        });
        alert('Registrasi berhasil!');
        togglePage();
      }
    });
  });
});

// ====== Login ======
loginBtn.addEventListener('click', () => {
  const email = document.getElementById('loginEmail').value.trim().toLowerCase();
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

        validateUserName(currentUserName, isValid => {
          if (isValid) showDashboard();
          else promptNameInput();
        });
      } else {
        alert('Password salah!');
      }
    } else {
      alert('Email tidak terdaftar!');
    }
  });
});

// ====== Prompt Input Nama ======
function promptNameInput() {
  loginPage.innerHTML = `
    <h3>Nama tidak valid atau sudah digunakan! Masukkan nama lain:</h3>
    <input type="text" id="nameInput" placeholder="Nama Anda" />
    <button id="confirmNameBtn">Konfirmasi Nama</button>
  `;

  const confirmBtn = document.getElementById('confirmNameBtn');
  confirmBtn.addEventListener('click', () => {
    const nameInput = document.getElementById('nameInput').value.trim();
    if (!nameInput) {
      alert('Nama harus diisi!');
      return;
    }

    validateUserName(nameInput, isValid => {
      if (isValid) {
        currentUserName = nameInput;
        db.ref('users/' + currentUserKey).update({ name: nameInput });
        showDashboard();
      } else {
        alert('Nama tidak valid atau sudah digunakan! Silakan ganti.');
      }
    });
  });
}

// ====== Dashboard ======
function showDashboard() {
  loginPage.style.display = 'none';
  registerPage.style.display = 'none';
  dashboard.style.display = 'block';
  chatPage.style.display = 'none';
  initRelay();
  lockBtn.style.display = currentUserRole === 'admin' ? 'block' : 'none';
}

// ====== Tampilkan Login ======
function showLogin() {
  loginPage.style.display = 'block';
  registerPage.style.display = 'none';
  dashboard.style.display = 'none';
  chatPage.style.display = 'none';
}

// ====== Logout ======
logoutBtn.addEventListener('click', () => {
  localStorage.clear();
  currentUserKey = null;
  currentUserRole = null;
  currentUserName = '';
  showLogin();
});

// ====== Inisialisasi Relay ======
function initRelay() {
  const relayRef = db.ref('relay');

  relayRef.on('value', snap => {
    const data = snap.val() || {};
    const status = data.status || 'off';
    const lastUser = data.lastUser || '--';

    updateRelayUI(status);
    document.getElementById('status').textContent = `Status: ${status.toUpperCase()} oleh ${lastUser}`;
  });

  db.ref('relay/lock').on('value', snap => updateLockUI(snap.val() || 'off'));
}

// ====== Update UI Relay & Lock ======
function updateRelayUI(status) {
  relayBtn.textContent = status === 'on' ? 'Matikan Pompa Air' : 'Hidupkan Pompa Air';
}

function updateLockUI(lockStatus) {
  lockIndicator.textContent = lockStatus === 'on' ? 'Lock: ON' : 'Lock: OFF';
  lockIndicator.style.color = lockStatus === 'on' ? 'red' : 'green';
  if (currentUserRole !== 'admin') relayBtn.disabled = lockStatus === 'on';
  lockBtn.textContent = lockStatus === 'on' ? 'Unlock Relay' : 'Lock Relay';
}

// ====== Toggle Relay ======
relayBtn.addEventListener('click', () => {
  db.ref('relay/lock').once('value', snap => {
    if (snap.val() === 'on' && currentUserRole !== 'admin') {
      alert('Relay terkunci oleh admin!');
      return;
    }
    toggleRelayStatus();
  });
});

function toggleRelayStatus(forceStatus = null) {
  const relayRef = db.ref('relay');

  relayRef.once('value', snap => {
    const current = snap.val() || {};
    const newStatus = forceStatus ? forceStatus : (current.status || 'off') === 'on' ? 'off' : 'on';

    relayRef.update({
      status: newStatus,
      lastUser: currentUserName
    });
  });
}

// ====== Toggle Lock ======
lockBtn.addEventListener('click', () => {
  if (currentUserRole !== 'admin') return;

  const lockRef = db.ref('relay/lock');
  const keyRef = db.ref('relay/lockKey');

  lockRef.once('value', snap => {
    const lockStatus = snap.val() || 'off';
    if (lockStatus === 'off') {
      const kunci = prompt("Masukkan teks kunci untuk LOCK:");
      if (!kunci) return alert("Lock dibatalkan karena kunci kosong!");
      lockRef.set('on');
      keyRef.set(kunci);
    } else {
      keyRef.once('value', snapKey => {
        const savedKey = snapKey.val();
        const inputKey = prompt("Masukkan teks kunci untuk UNLOCK:");
        if (inputKey === savedKey) {
          lockRef.set('off');
          keyRef.remove();
        } else alert("Kunci salah! Tidak bisa Unlock.");
      });
    }
  });
});

// ====== Voice Command ======
if (voiceBtn && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)) {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const recognition = new SpeechRecognition();
  recognition.lang = 'id-ID';
  recognition.continuous = false;
  recognition.interimResults = false;

  voiceBtn.addEventListener('click', () => {
    recognition.start();
    voiceBtn.textContent = "🎙️ Mendengarkan...";
  });

  recognition.onresult = (event) => {
    const command = event.results[0][0].transcript.toLowerCase();
    voiceBtn.textContent = "🎤 Voice Command";

    if (command.includes("nyalakan")) toggleRelayStatus("on");
    else if (command.includes("matikan")) toggleRelayStatus("off");
    else alert("Perintah tidak dikenali! Gunakan 'nyalakan' atau 'matikan'.");
  };

  recognition.onerror = () => {
    voiceBtn.textContent = "🎤 Voice Command";
    alert("Terjadi error saat mendengarkan suara.");
  };
} else if (voiceBtn) {
  voiceBtn.addEventListener('click', () => {
    alert("Voice command tidak tersedia di browser Android. Gunakan Chrome di PC.");
  });
}

// ====== EXPORT untuk chat.js ======
export {
  db,
  currentUserKey,
  currentUserRole,
  currentUserName,
  dashboard,
  chatPageBtn
};
