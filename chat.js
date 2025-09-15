// chat.js
import { db, currentUserKey, currentUserRole, currentUserName, dashboard, chatPageBtn } from './app.js';

const chatPage = document.getElementById('chatPage');
const sendChatBtn = document.getElementById('sendChatBtn');
const chatInput = document.getElementById('chatInput');
const chatBox = document.getElementById('chatBox');
const backToDashboard = document.getElementById('backToDashboard');
const userListDiv = document.getElementById('userList');

// ====== Badge Notifikasi ======
let notifCount = 0;
const notifBadge = document.createElement('span');
notifBadge.style.background = '#ff4b2b';
notifBadge.style.color = '#fff';
notifBadge.style.borderRadius = '50%';
notifBadge.style.padding = '2px 6px';
notifBadge.style.fontSize = '12px';
notifBadge.style.marginLeft = '5px';
notifBadge.style.display = 'none';
chatPageBtn.appendChild(notifBadge);

// ====== Audio Notifikasi (mirip WA) ======
const notifSound = new Audio('https://assets.mixkit.co/sfx/download/mixkit-software-interface-back-2575.mp3');

// ====== Last Read Tracking ======
function updateLastRead() {
  db.ref(`users/${currentUserKey}/lastRead`).set(Date.now());
}

async function checkUnreadMessages() {
  const lastReadSnap = await db.ref(`users/${currentUserKey}/lastRead`).once('value');
  let lastReadTime = lastReadSnap.exists() ? lastReadSnap.val() : 0;

  // cek global chat
  db.ref('chat/global').once('value', snapshot => {
    let unread = 0;
    snapshot.forEach(msgSnap => {
      const msg = msgSnap.val();
      if (msg.userKey !== currentUserKey && msg.timestamp > lastReadTime) {
        unread++;
      }
    });
    if (unread > 0) {
      notifSound.play();
      notifCount += unread;
      notifBadge.textContent = notifCount;
      notifBadge.style.display = 'inline-block';
      document.title = `💬 (${notifCount}) Pesan Belum Dibaca`;
    }
  });
}

// ====== Tombol Hapus Semua Chat untuk Admin ======
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
    db.ref('chat/global').remove();
    db.ref('chat/private').remove();
  }
});

// ====== Toggle Halaman Chat ======
chatPageBtn.addEventListener('click', () => {
  dashboard.style.display = 'none';
  chatPage.style.display = 'block';
  loadUsers();
  loadChats();
  // reset notif saat masuk chat
  notifCount = 0;
  notifBadge.style.display = 'none';
  document.title = 'Dashboard IoT';
  updateLastRead();
});

backToDashboard.addEventListener('click', () => {
  chatPage.style.display = 'none';
  dashboard.style.display = 'block';
  notifCount = 0;
  notifBadge.style.display = 'none';
  document.title = 'Dashboard IoT';
});

// ====== Mode Chat ======
let chatMode = 'global'; // default global
let privateUserKey = null;

const chatModeBtn = document.createElement('button');
chatModeBtn.textContent = '🌐 Global Chat';
chatModeBtn.style.marginTop = '10px';
chatPage.insertBefore(chatModeBtn, chatBox);

chatModeBtn.addEventListener('click', () => {
  if (chatMode === 'global') {
    const selectedUserKey = prompt("Masukkan User Key untuk chat privat:");
    if (!selectedUserKey || selectedUserKey === currentUserKey) {
      alert("User tidak valid!");
      return;
    }
    privateUserKey = selectedUserKey;
    chatMode = 'private';
    chatModeBtn.textContent = '🔒 Private Chat';
  } else {
    chatMode = 'global';
    privateUserKey = null;
    chatModeBtn.textContent = '🌐 Global Chat';
  }
  loadChats();
});

// ====== Kirim Pesan ======
sendChatBtn.addEventListener('click', () => {
  const text = chatInput.value.trim();
  if (!text) return;

  const timestamp = Date.now();
  const timeStr = new Date(timestamp).toLocaleTimeString();
  const chatId = db.ref('chat').push().key;

  if (chatMode === 'global') {
    db.ref('chat/global/' + chatId).set({
      userKey: currentUserKey,
      userName: currentUserName,
      text,
      time: timeStr,
      timestamp
    });
  } else if (chatMode === 'private') {
    const chatPath = [currentUserKey, privateUserKey].sort().join('_');
    db.ref('chat/private/' + chatPath + '/' + chatId).set({
      senderKey: currentUserKey,
      senderName: currentUserName,
      text,
      time: timeStr,
      timestamp
    });
  }

  chatInput.value = '';
});

// ====== Load Chat Realtime dengan Notifikasi ======
function loadChats() {
  chatBox.innerHTML = '';

  if (chatMode === 'global') {
    db.ref('chat/global').off();
    db.ref('chat/global').on('child_added', snapshot => {
      appendChat(snapshot.key, snapshot.val(), 'global');
      if (chatPage.style.display === 'none' && snapshot.val().userKey !== currentUserKey) {
        notifSound.play();
        notifCount++;
        notifBadge.textContent = notifCount;
        notifBadge.style.display = 'inline-block';
        document.title = `💬 (${notifCount}) Pesan Baru!`;
      }
    });
  } else if (chatMode === 'private') {
    const chatPath = [currentUserKey, privateUserKey].sort().join('_');
    db.ref('chat/private/' + chatPath).off();
    db.ref('chat/private/' + chatPath).on('child_added', snapshot => {
      appendChat(snapshot.key, snapshot.val(), 'private');
      const sender = snapshot.val().senderKey;
      if (chatPage.style.display === 'none' && sender !== currentUserKey) {
        notifSound.play();
        notifCount++;
        notifBadge.textContent = notifCount;
        notifBadge.style.display = 'inline-block';
        document.title = `💬 (${notifCount}) Pesan Privat Baru!`;
      }
    });
  }

  deleteAllBtn.style.display = currentUserRole === 'admin' ? 'block' : 'none';
}

// ====== Append Chat Helper ======
function appendChat(key, chat, type) {
  const div = document.createElement('div');
  div.classList.add('chatMsg');
  div.innerHTML = `
    <div class="chatHeader">
      ${chat.userName || chat.senderName} 
      <span style="font-size:12px; color:#aaa;">${chat.time || ''}</span>
    </div>
    <div class="chatText">${chat.text}</div>
  `;

  if ((chat.userKey === currentUserKey) || (chat.senderKey === currentUserKey)) {
    const delBtn = document.createElement('button');
    delBtn.textContent = 'Hapus';
    delBtn.classList.add('deleteBtn');
    delBtn.addEventListener('click', () => {
      const path = type === 'global' ? 'global' : 'private/' + [currentUserKey, privateUserKey].sort().join('_');
      db.ref('chat/' + path + '/' + key).remove();
    });
    div.appendChild(delBtn);
  }

  chatBox.appendChild(div);
  chatBox.scrollTop = chatBox.scrollHeight;
}

// ====== Load List User ======
function loadUsers() {
  userListDiv.innerHTML = '';
  db.ref('users').once('value', snapshot => {
    snapshot.forEach(child => {
      const user = child.val();
      if (user.key !== currentUserKey) {
        const userBtn = document.createElement('button');
        userBtn.textContent = user.name || user.email;
        userBtn.style.display = 'block';
        userBtn.style.width = '100%';
        userBtn.style.margin = '3px 0';
        userBtn.style.background = '#394867';
        userBtn.style.color = '#fff';
        userBtn.style.border = 'none';
        userBtn.style.borderRadius = '5px';
        userBtn.style.cursor = 'pointer';
        userBtn.addEventListener('click', () => {
          chatMode = 'private';
          privateUserKey = child.key;
          chatModeBtn.textContent = '🔒 Private Chat';
          loadChats();
        });
        userListDiv.appendChild(userBtn);
      }
    });
  });
}

// ====== Cek Unread Saat Login ======
checkUnreadMessages();
