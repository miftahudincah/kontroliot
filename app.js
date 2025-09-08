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
        else promptNameInput(); // tampilkan input name jika nama tidak valid
      });
    } else {
      localStorage.clear();
      showLogin();
    }
  });
} else {
  showLogin();
}

// ====== Fungsi Validasi Nama (case-insensitive) ======
function validateUserName(name, callback) {
  const lowerName = name.toLowerCase();
  db.ref('validNames').orderByKey().once('value', snapshot => {
    let exists = false;
    snapshot.forEach(child => {
      if (child.key.toLowerCase() === lowerName) exists = true;
    });
    callback(exists);
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
    <h3>Nama tidak valid! Masukkan nama Anda:</h3>
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
        alert('Nama tidak valid atau tidak terdaftar!');
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
  const relayRef = db.ref('relay/status');
  const lockRef = db.ref('relay/lock');
  const historyRef = db.ref('relay/history');

  relayRef.on('value', snap => updateRelayUI(snap.val() || 'off'));
  lockRef.on('value', snap => updateLockUI(snap.val() || 'off'));
  historyRef.on('value', snap => {
    document.getElementById('status').textContent = `Status: ${snap.val() || '--'}`;
  });
}

// ====== Update UI Relay & Lock ======
function updateRelayUI(status) {
  relayBtn.textContent = status === 'on' ? 'Matikan Pompa Air' : 'Hidupkan Pompa Air';
}

function updateLockUI(lockStatus) {
  lockIndicator.textContent = lockStatus === 'on' 
    ? 'Lock: ON (Relay terkunci oleh Admin)' 
    : 'Lock: OFF (Relay bisa digunakan)';
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
  const relayRef = db.ref('relay/status');
  const historyRef = db.ref('relay/history');

  relayRef.once('value', snap => {
    const newStatus = forceStatus ? forceStatus : (snap.val() || 'off') === 'on' ? 'off' : 'on';
    relayRef.set(newStatus);
    historyRef.set(`${currentUserName} menekan ${newStatus.toUpperCase()}`);
  });
}

// ====== Toggle Lock dengan Kunci ======
lockBtn.addEventListener('click', () => {
  if (currentUserRole !== 'admin') return;

  const lockRef = db.ref('relay/lock');
  const keyRef = db.ref('relay/lockKey');
  const historyRef = db.ref('relay/history');

  lockRef.once('value', snap => {
    const lockStatus = snap.val() || 'off';
    if (lockStatus === 'off') {
      const kunci = prompt("Masukkan teks kunci untuk LOCK:");
      if (!kunci) return alert("Lock dibatalkan karena kunci kosong!");
      lockRef.set('on');
      keyRef.set(kunci);
      historyRef.set(`${currentUserName} mengunci relay dengan kunci`);
    } else {
      keyRef.once('value', snapKey => {
        const savedKey = snapKey.val();
        const inputKey = prompt("Masukkan teks kunci untuk UNLOCK:");
        if (inputKey === savedKey) {
          lockRef.set('off');
          keyRef.remove();
          historyRef.set(`${currentUserName} membuka kunci relay`);
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
