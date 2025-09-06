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

const registerBtn = document.getElementById('registerBtn');
const loginBtn = document.getElementById('loginBtn');
const logoutBtn = document.getElementById('logoutBtn');
const toLogin = document.getElementById('toLogin');
const toRegister = document.getElementById('toRegister');
const relayBtn = document.getElementById('relayBtn');
const lockBtn = document.getElementById('lockBtn');
const lockIndicator = document.getElementById('lockIndicator');
const voiceBtn = document.getElementById('voiceBtn');
const chatPageBtn = document.getElementById('chatPageBtn');
const backToDashboard = document.getElementById('backToDashboard');
const sendChatBtn = document.getElementById('sendChatBtn');
const chatInput = document.getElementById('chatInput');
const chatBox = document.getElementById('chatBox');

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
      showDashboard();
    } else {
      localStorage.clear();
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
        role: 'user'
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

// ====== Dashboard ======
function showDashboard() {
  loginPage.style.display = 'none';
  registerPage.style.display = 'none';
  dashboard.style.display = 'block';
  chatPage.style.display = 'none';
  initRelay();

  if (currentUserRole === 'admin') {
    lockBtn.style.display = 'block';
  } else {
    lockBtn.style.display = 'none';
  }
}

// ====== Logout ======
logoutBtn.addEventListener('click', () => {
  localStorage.clear();
  currentUserKey = null;
  currentUserRole = null;
  currentUserName = '';
  dashboard.style.display = 'none';
  chatPage.style.display = 'none';
  loginPage.style.display = 'block';
});

// ====== Inisialisasi Relay ======
function initRelay() {
  const relayRef = db.ref('relay/status');
  const lockRef = db.ref('relay/lock');
  const historyRef = db.ref('relay/history');

  relayRef.on('value', snap => {
    updateRelayUI(snap.val() || 'off');
  });

  lockRef.on('value', snap => {
    updateLockUI(snap.val() || 'off');
  });

  historyRef.on('value', snap => {
    document.getElementById('status').textContent = `Status: ${snap.val() || '--'}`;
  });
}

// ====== Update UI Relay & Lock ======
function updateRelayUI(status) {
  relayBtn.textContent = status === 'on' ? 'Matikan Pompa Air' : 'Hidupkan Pompa Air';
}

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
    }
    toggleRelayStatus();
  });
});

function toggleRelayStatus(forceStatus = null) {
  const relayRef = db.ref('relay/status');
  const historyRef = db.ref('relay/history');
  relayRef.once('value', snap => {
    let newStatus;
    if (forceStatus) {
      newStatus = forceStatus;
    } else {
      newStatus = (snap.val() || 'off') === 'on' ? 'off' : 'on';
    }
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
      if (!kunci) {
        alert("Lock dibatalkan karena kunci kosong!");
        return;
      }
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
        } else {
          alert("Kunci salah! Tidak bisa Unlock.");
        }
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

// ====== CHAT FEATURE ======

// tombol Hapus Semua Chat untuk admin
let deleteAllBtn = document.createElement('button');
deleteAllBtn.textContent = 'Hapus Semua Chat';
deleteAllBtn.style.background = '#ff4b2b';
deleteAllBtn.style.color = '#fff';
deleteAllBtn.style.border = 'none';
deleteAllBtn.style.padding = '8px 12px';
deleteAllBtn.style.borderRadius = '6px';
deleteAllBtn.style.cursor = 'pointer';
deleteAllBtn.style.marginTop = '8px';
chatPage.appendChild(deleteAllBtn);

deleteAllBtn.addEventListener('click', () => {
  if (currentUserRole !== 'admin') return;
  if (confirm('Apakah Anda yakin ingin menghapus semua chat?')) {
    db.ref('chat').remove();
  }
});

// buka chat
chatPageBtn.addEventListener('click', () => {
  dashboard.style.display = 'none';
  chatPage.style.display = 'block';
  loadChats();
});

// kembali ke dashboard
backToDashboard.addEventListener('click', () => {
  chatPage.style.display = 'none';
  dashboard.style.display = 'block';
});

// kirim pesan dengan jam
sendChatBtn.addEventListener('click', () => {
  const text = chatInput.value.trim();
  if (!text) return;

  const now = new Date();
  const timestamp = now.toLocaleTimeString(); // HH:MM:SS
  const chatId = db.ref('chat').push().key;

  db.ref('chat/' + chatId).set({
    userKey: currentUserKey,
    userName: currentUserName,
    text,
    time: timestamp
  });

  chatInput.value = '';
});

// tampilkan chat realtime dengan jam dan tombol Hapus per chat
function loadChats() {
  db.ref('chat').off();
  db.ref('chat').on('value', snapshot => {
    chatBox.innerHTML = '';

    snapshot.forEach(child => {
      const chat = child.val();
      const div = document.createElement('div');
      div.classList.add('chatMsg');
      div.innerHTML = `
        <div class="chatHeader">
          ${chat.userName} 
          <span style="font-size:12px; color:#aaa;">${chat.time || ''}</span>
        </div>
        <div class="chatText">${chat.text}</div>
      `;

      // Hapus per chat jika pemilik
      if (chat.userKey === currentUserKey) {
        const delBtn = document.createElement('button');
        delBtn.textContent = 'Hapus';
        delBtn.classList.add('deleteBtn');
        delBtn.addEventListener('click', () => {
          db.ref('chat/' + child.key).remove();
        });
        div.appendChild(delBtn);
      }

      chatBox.appendChild(div);
    });

    chatBox.scrollTop = chatBox.scrollHeight;

    // tampilkan tombol Hapus Semua hanya untuk admin
    deleteAllBtn.style.display = currentUserRole === 'admin' ? 'block' : 'none';
  });
}
