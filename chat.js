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

// ====== Audio Notifikasi ======
const notifSound = new Audio('https://www.myinstants.com/media/sounds/bleep.mp3');

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
    db.ref('chat').remove();
  }
});

// ====== Toggle Halaman Chat ======
chatPageBtn.addEventListener('click', () => {
  dashboard.style.display = 'none';
  chatPage.style.display = 'block';
  loadUsers();
  loadChats();
  // Reset notif
  notifCount = 0;
  notifBadge.style.display = 'none';
});

backToDashboard.addEventListener('click', () => {
  chatPage.style.display = 'none';
  dashboard.style.display = 'block';
});

// ====== Mode Chat ======
let chatMode = 'global'; // default global
let privateUserKey = null;

// tombol toggle global/private
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

  const now = new Date();
  const timestamp = now.toLocaleTimeString();
  const chatId = db.ref('chat').push().key;

  if (chatMode === 'global') {
    db.ref('chat/global/' + chatId).set({
      userKey: currentUserKey,
      userName: currentUserName,
      text,
      time: timestamp
    });
  } else if (chatMode === 'private') {
    const chatPath = [currentUserKey, privateUserKey].sort().join('_');
    db.ref('chat/private/' + chatPath + '/' + chatId).set({
      senderKey: currentUserKey,
      senderName: currentUserName,
      text,
      time: timestamp
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
      // Notifikasi jika chatPage tidak aktif dan bukan pesan sendiri
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

  // tampilkan tombol Hapus Semua hanya untuk admin
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

  // Hapus pesan milik sendiri
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

  // Reset title saat user membuka chat
  chatPage.addEventListener('mouseenter', () => {
    document.title = 'Dashboard IoT';
    notifCount = 0;
    notifBadge.style.display = 'none';
  });
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
