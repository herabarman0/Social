// ======== FIREBASE CONFIG ========
const firebaseConfig = {
  apiKey: "AIzaSyC9LCjyg8TLVdFoVig9O7JzYCvKzG9Ra8g",
  authDomain: "xxxx-96ce6.firebaseapp.com",
  databaseURL: "https://xxxx-96ce6-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "xxxx-96ce6",
  storageBucket: "xxxx-96ce6.firebasestorage.app",
  messagingSenderId: "739849047741",
  appId: "1:739849047741:web:fcc4249ddd76e0948bb1d4",
  measurementId: "G-Y54BDF6WSY"
};
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
const rtdb = firebase.database();

// ======== STATE ========
let currentUser = null;
let currentProfile = null;
let chatPartnerId = null;
let chatUnsub = null;
let currentStories = [];
let currentStoryIndex = 0;
let storyTimer = null;
let selectedPostId = null;
let selectedImageBase64 = null;
let selectedImageFile = null;
let selectedStoryFile = null;
let selectedStoryType = null;
let selectedStoryBg = '#1877f2';
let selectedFeeling = null;
let typingTimeout = null;
let msgPeerId = null;
let msgListUnsub = null;

const FEELINGS = [
  {emoji:'😊',text:'খুশি'},  {emoji:'😢',text:'দুঃখিত'},  {emoji:'😠',text:'রাগান্বিত'},
  {emoji:'😍',text:'প্রেমময়'},  {emoji:'😴',text:'ক্লান্ত'},  {emoji:'🤒',text:'অসুস্থ'},
  {emoji:'🎉',text:'উৎসাহিত'},  {emoji:'😮',text:'অবাক'},  {emoji:'🙏',text:'কৃতজ্ঞ'},
  {emoji:'💪',text:'শক্তিশালী'},  {emoji:'😎',text:'দারুণ'},  {emoji:'🤔',text:'চিন্তিত'},
];
const REACTIONS = ['👍','❤️','😂','😮','😢','😡'];

// ======== HELPERS ========
function esc(str) {
  if (str === undefined || str === null) return '';
  return String(str).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}

function avatar(name) {
  const n = encodeURIComponent(name || 'User');
  return `https://ui-avatars.com/api/?name=${n}&background=1877f2&color=fff&bold=true`;
}

function formatTime(date) {
  if (!date) return '';
  const now = new Date();
  const diff = Math.floor((now - date) / 1000);
  if (diff < 60) return 'এইমাত্র';
  if (diff < 3600) return Math.floor(diff/60) + ' মিনিট আগে';
  if (diff < 86400) return Math.floor(diff/3600) + ' ঘণ্টা আগে';
  if (diff < 604800) return Math.floor(diff/86400) + ' দিন আগে';
  return date.toLocaleDateString('bn-BD', { day:'numeric', month:'short', year:'numeric' });
}

function renderVideoEmbed(text) {
  const ytMatch = text && text.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]{11})/);
  if (ytMatch) {
    return `<div style="padding:0 16px 12px"><iframe width="100%" height="300" style="border-radius:8px;border:none" src="https://www.youtube.com/embed/${ytMatch[1]}" allowfullscreen></iframe></div>`;
  }
  return '';
}

function showToast(msg) {
  const c = document.getElementById('toastContainer');
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  c.appendChild(t);
  setTimeout(() => t.remove(), 3000);
}

// ======== AUTH ========
auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);
auth.onAuthStateChanged(async user => {
  if (user) {
    currentUser = user;
    initApp(user);
    saveUserToFirestore(user);
  } else {
    showAuth();
  }
});

async function loginWithGoogle() {
  const provider = new firebase.auth.GoogleAuthProvider();
  try {
    await auth.signInWithPopup(provider);
  } catch(e) {
    showToast('লগইন ব্যর্থ: ' + e.message);
  }
}

async function saveUserToFirestore(user) {
  const ref = db.collection('users').doc(user.uid);
  const snap = await ref.get();
  const existing = snap.exists ? snap.data() : {};
  await ref.set({
    uid: user.uid,
    name: existing.name || user.displayName,
    email: user.email,
    photo: user.photoURL,
    bio: existing.bio || '',
    city: existing.city || '',
    work: existing.work || '',
    education: existing.education || '',
    website: existing.website || '',
    birthday: existing.birthday || '',
    friendCount: existing.friendCount || 0,
    postCount: existing.postCount || 0,
    lastSeen: firebase.firestore.FieldValue.serverTimestamp(),
    online: true,
    createdAt: existing.createdAt || firebase.firestore.FieldValue.serverTimestamp()
  }, { merge: true });
  rtdb.ref('online/' + user.uid).set(true);
  rtdb.ref('online/' + user.uid).onDisconnect().remove();
}

function logout() {
  if (currentUser) {
    rtdb.ref('online/' + currentUser.uid).remove();
    db.collection('users').doc(currentUser.uid).update({ online: false });
  }
  auth.signOut().then(() => {
    currentUser = null;
    ['notifPanel','profileDropdown','freqPanel'].forEach(id => {
      const el = document.getElementById(id); if(el) el.classList.remove('show');
    });
    document.getElementById('profilePage').style.display = 'none';
    document.getElementById('mainApp').style.display = 'none';
    document.getElementById('navbar').style.display = 'none';
    const mp = document.getElementById('messagesPage');
    if(mp) mp.style.display = 'none';
    document.getElementById('authScreen').style.display = 'flex';
  });
}

// ======== UI INIT ========
function showAuth() {
  document.getElementById('authScreen').style.display = 'flex';
  document.getElementById('navbar').style.display = 'none';
  document.getElementById('mainApp').style.display = 'none';
  document.getElementById('profilePage').style.display = 'none';
}

function initApp(user) {
  document.getElementById('authScreen').style.display = 'none';
  document.getElementById('navbar').style.display = 'flex';
  document.getElementById('mainApp').style.display = 'block';
  document.getElementById('profilePage').style.display = 'none';

  const photo = user.photoURL || avatar(user.displayName);
  const name = user.displayName || 'ব্যবহারকারী';

  ['navAvatar','pdAvatar','cpAvatar','modalAvatar','leftAvatar','storyMeAvatar'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.src = photo;
  });
  document.getElementById('pdName').textContent = name;
  document.getElementById('pdEmail').textContent = user.email;
  document.getElementById('cpName').textContent = name.split(' ')[0];
  document.getElementById('modalName').textContent = name;
  document.getElementById('leftName').textContent = name;

  loadFeed();
  loadOnlineFriends();
  loadNotifications();
  loadFriendRequests();
  loadPeopleYouMayKnow();
  loadBirthdays();
  loadStories();
  setupFeelingPicker();
  listenIncomingMessages();

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.nav-search')) {
      document.getElementById('searchResults')?.classList.remove('show');
    }
    if (!e.target.closest('.post-menu')) {
      document.querySelectorAll('.post-menu-dropdown').forEach(d => d.classList.remove('show'));
    }
  });
}

function showMainApp() {
  document.getElementById('messagesPage').style.display = 'none';
  document.getElementById('profilePage').style.display = 'none';
  document.getElementById('mainApp').style.display = 'block';
}

// ======== TABS ========
function switchTab(tab, el) {
  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  document.getElementById(tab + 'Tab').classList.add('active');
  document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
  if (el && el.classList.contains('nav-tab')) el.classList.add('active');
  else {
    const map = { feed: 'tabHome', friends: 'tabFriends' };
    document.getElementById(map[tab])?.classList.add('active');
  }
  showMainApp();
  if (tab === 'friends') loadFriendsPage();
}

function setMobileActive(el) {
  document.querySelectorAll('.mobile-nav-item').forEach(i => i.classList.remove('active'));
  el.classList.add('active');
}

// ======== SEARCH ========
let searchTimeout = null;
function handleSearch(value) {
  clearTimeout(searchTimeout);
  const box = document.getElementById('searchResults');
  if (!value.trim()) { box.classList.remove('show'); box.innerHTML=''; return; }
  searchTimeout = setTimeout(async () => {
    const snap = await db.collection('users').orderBy('name').startAt(value).endAt(value + '\uf8ff').limit(8).get();
    box.innerHTML = '';
    if (snap.empty) { box.innerHTML = '<div style="padding:14px;color:var(--text-secondary);font-size:.85rem">কোনো ফলাফল নেই</div>'; }
    snap.forEach(doc => {
      if (doc.id === currentUser?.uid) return;
      const d = doc.data();
      const p = d.photo || avatar(d.name);
      box.innerHTML += `<div class="search-result-item" onclick="viewProfile('${doc.id}');document.getElementById('searchResults').classList.remove('show');document.getElementById('searchInput').value=''">
        <img src="${p}" alt="">
        <div class="search-result-info">
          <div class="search-result-name">${esc(d.name||'')}</div>
          <div class="search-result-sub">${esc(d.city||'post.com সদস্য')}</div>
        </div>
      </div>`;
    });
    box.classList.add('show');
  }, 300);
}
function showSearchResults() {
  const box = document.getElementById('searchResults');
  if (box.innerHTML.trim()) box.classList.add('show');
}

// ======== POSTS ========
let lastPost = null;

async function loadFeed() {
  const container = document.getElementById('feedContainer');
  container.innerHTML = '<div class="loader"><div class="spinner"></div>পোস্ট লোড হচ্ছে...</div>';
  try {
    const snap = await db.collection('posts').orderBy('createdAt','desc').limit(15).get();
    container.innerHTML = '';
    if (snap.empty) {
      container.innerHTML = '<div class="loader" style="color:var(--text-secondary)">কোনো পোস্ট নেই। প্রথম পোস্টটি করুন! 🎉</div>';
    } else {
      snap.forEach(doc => renderPost({ id: doc.id, ...doc.data() }));
      lastPost = snap.docs[snap.docs.length - 1];
    }
  } catch(e) {
    container.innerHTML = `<div class="loader" style="color:red">পোস্ট লোড করা যায়নি।<br><small>${esc(e.message)}</small></div>`;
  }
  // Real-time
  db.collection('posts').orderBy('createdAt','desc').limit(1)
    .onSnapshot(snap => {
      snap.docChanges().forEach(change => {
        if (change.type === 'added') {
          const data = { id: change.doc.id, ...change.doc.data() };
          if (!document.getElementById('post-' + data.id)) prependPost(data);
        }
      });
    });
}

function renderPost(post, prepend = false, container = null) {
  const c = container || document.getElementById('feedContainer');
  if (document.getElementById('post-' + post.id)) return;
  const div = document.createElement('div');
  div.className = 'post-card';
  div.id = 'post-' + post.id;
  const photo = post.authorPhoto || avatar(post.authorName);
  const timeAgo = post.createdAt ? formatTime(post.createdAt.toDate ? post.createdAt.toDate() : new Date(post.createdAt)) : 'এইমাত্র';
  const likes = post.likes || 0;
  const isLiked = post.likedBy && currentUser && post.likedBy[currentUser.uid];
  const topReaction = getTopReaction(post.reactions || {});
  const isMine = currentUser && post.authorUid === currentUser.uid;

  div.innerHTML = `
    <div class="post-header">
      <img class="post-avatar" src="${photo}" alt="" data-uid="${post.authorUid}" onclick="viewProfile('${post.authorUid}')">
      <div class="post-meta">
        <div class="post-author" onclick="viewProfile('${post.authorUid}')"><span class="post-author-name" data-uid="${post.authorUid}">${esc(post.authorName||'ব্যবহারকারী')}</span>${post.feeling ? ` — ${post.feeling}` : ''}</div>
        <div class="post-time"><i class="fas fa-globe-asia" style="font-size:.7rem"></i> ${timeAgo} ${post.location ? '· 📍 '+esc(post.location) : ''}</div>
      </div>
      <div class="post-menu" onclick="togglePostMenu('${post.id}',this)">
        <i class="fas fa-ellipsis-h"></i>
        <div class="post-menu-dropdown" id="pmenu-${post.id}">
          ${isMine ? `<div class="post-menu-item" onclick="deletePost('${post.id}')"><i class="fas fa-trash" style="color:var(--red)"></i> পোস্ট মুছুন</div>` : ''}
          <div class="post-menu-item" onclick="savePost('${post.id}')"><i class="fas fa-bookmark"></i> সেভ করুন</div>
          <div class="post-menu-item" onclick="copyLink('${post.id}')"><i class="fas fa-link"></i> লিঙ্ক কপি</div>
          ${!isMine ? `<div class="post-menu-item" onclick="reportPost('${post.id}')"><i class="fas fa-flag" style="color:var(--red)"></i> রিপোর্ট করুন</div>` : ''}
        </div>
      </div>
    </div>
    ${post.text ? `<div class="post-text">${esc(post.text)}</div>` : ''}
    ${post.imageUrl ? `<img class="post-image" src="${post.imageUrl}" alt="" loading="lazy" onclick="openLightbox(this.src)">` : ''}
    ${!post.imageUrl && post.text ? renderVideoEmbed(post.text) : ''}
    <div class="post-stats">
      <div class="post-stats-likes" onclick="viewReactions('${post.id}')">
        ${likes > 0 ? `<div class="like-emojis">${topReaction}</div> <span>${likes}</span>` : ''}
      </div>
      <div style="display:flex;gap:12px;font-size:.88rem;color:var(--text-secondary)">
        <span onclick="toggleComments('${post.id}')" style="cursor:pointer">${post.commentCount||0} মন্তব্য</span>
        <span>${post.shareCount||0} শেয়ার</span>
      </div>
    </div>
    <div class="post-actions-bar">
      <button class="pa-btn ${isLiked?'liked':''}" id="likeBtn-${post.id}" onclick="likePost('${post.id}',this)" onmouseenter="showReactionPicker('${post.id}')" onmouseleave="hideReactionPickerDelayed('${post.id}')">
        <div class="reaction-picker" id="rp-${post.id}" onmouseenter="cancelHideReaction('${post.id}')" onmouseleave="hideReactionPicker('${post.id}')">
          ${REACTIONS.map(r=>`<span class="reaction-emoji" onclick="reactToPost(event,'${post.id}','${r}')">${r}</span>`).join('')}
        </div>
        <i class="fa${isLiked?'s':'r'} fa-thumbs-up"></i> লাইক
      </button>
      <button class="pa-btn" onclick="toggleComments('${post.id}')"><i class="far fa-comment"></i> মন্তব্য</button>
      <button class="pa-btn" onclick="openShareModal('${post.id}')"><i class="fas fa-share"></i> শেয়ার</button>
    </div>
    <div id="comments-${post.id}" class="post-comments" style="display:none"></div>
    <div id="cInput-${post.id}" class="comment-input-row" style="display:none">
      <img src="${currentUser?.photoURL||avatar(currentUser?.displayName)}" class="comment-avatar" alt="">
      <input class="comment-input" placeholder="মন্তব্য করুন..." onkeydown="if(event.key==='Enter')submitComment('${post.id}',this)">
      <i class="fas fa-paper-plane comment-send" onclick="submitComment('${post.id}',this.previousElementSibling)"></i>
    </div>
  `;
  if (prepend && c.firstChild) c.insertBefore(div, c.firstChild);
  else c.appendChild(div);
}

function prependPost(post) { renderPost(post, true); }

function getTopReaction(reactions) {
  const counts = {};
  Object.values(reactions).forEach(r => { counts[r] = (counts[r]||0)+1; });
  const sorted = Object.entries(counts).sort((a,b)=>b[1]-a[1]);
  if (!sorted.length) return '<span>👍</span>';
  return sorted.slice(0,2).map(([r])=>`<span class="like-emoji">${r}</span>`).join('');
}

// REACTIONS
let reactionHideTimers = {};
function showReactionPicker(postId) {
  clearTimeout(reactionHideTimers[postId]);
  document.getElementById('rp-'+postId)?.classList.add('show');
}
function hideReactionPickerDelayed(postId) {
  reactionHideTimers[postId] = setTimeout(()=>hideReactionPicker(postId), 500);
}
function hideReactionPicker(postId) {
  document.getElementById('rp-'+postId)?.classList.remove('show');
}
function cancelHideReaction(postId) {
  clearTimeout(reactionHideTimers[postId]);
}

async function reactToPost(e, postId, emoji) {
  e.stopPropagation();
  hideReactionPicker(postId);
  if (!currentUser) return;
  const ref = db.collection('posts').doc(postId);
  const snap = await ref.get();
  if (!snap.exists) return;
  const data = snap.data();
  const likedBy = data.likedBy || {};
  const reactions = data.reactions || {};
  const uid = currentUser.uid;
  if (likedBy[uid]) {
    delete likedBy[uid];
    delete reactions[uid];
    await ref.update({ likes: Math.max((data.likes||0)-1,0), likedBy, reactions });
  } else {
    likedBy[uid] = true;
    reactions[uid] = emoji;
    await ref.update({ likes: (data.likes||0)+1, likedBy, reactions });
    if (data.authorUid !== uid) addNotification(data.authorUid, `${currentUser.displayName} আপনার পোস্টে প্রতিক্রিয়া জানিয়েছেন।`, currentUser.photoURL);
  }
  const btn = document.getElementById('likeBtn-'+postId);
  if (btn) {
    const newLiked = !!likedBy[uid];
    btn.className = 'pa-btn' + (newLiked?' liked':'');
    const picker = btn.querySelector('.reaction-picker');
    btn.innerHTML = picker ? picker.outerHTML : '';
    btn.innerHTML += `<i class="fa${newLiked?'s':'r'} fa-thumbs-up"></i> ${newLiked ? emoji : 'লাইক'}`;
  }
}

async function likePost(postId, btn) {
  await reactToPost({ stopPropagation:()=>{} }, postId, '👍');
}

// COMMENTS
function toggleComments(postId) {
  const c = document.getElementById('comments-'+postId);
  const ci = document.getElementById('cInput-'+postId);
  const show = c.style.display==='none';
  c.style.display = show?'block':'none';
  ci.style.display = show?'flex':'none';
  if (show) loadComments(postId);
}

async function loadComments(postId) {
  const c = document.getElementById('comments-'+postId);
  c.innerHTML = '<div style="font-size:.82rem;color:var(--text-secondary);padding:4px">লোড হচ্ছে...</div>';
  const snap = await db.collection('posts').doc(postId).collection('comments').orderBy('createdAt','asc').limit(20).get();
  c.innerHTML = '';
  snap.forEach(doc => {
    const d = doc.data();
    const p = d.authorPhoto||avatar(d.authorName);
    const cid = doc.id;
    const isMine = currentUser && d.authorUid === currentUser.uid;
    c.innerHTML += `<div class="comment-item" id="comment-${cid}">
      <img class="comment-avatar" src="${p}" alt="" onclick="viewProfile('${d.authorUid||''}')">
      <div style="flex:1">
        <div class="comment-bubble">
          <div class="comment-author" onclick="viewProfile('${d.authorUid||''}')">${esc(d.authorName||'ব্যবহারকারী')}</div>
          <div class="comment-text">${esc(d.text)}</div>
        </div>
        <div class="comment-actions">
          <span class="comment-action-btn" onclick="likeComment('${postId}','${cid}')">লাইক ${d.likes||''}</span>
          <span class="comment-action-btn">রিপ্লাই</span>
          ${isMine?`<span class="comment-action-btn" onclick="deleteComment('${postId}','${cid}')" style="color:var(--red)">মুছুন</span>`:''}
          <span style="margin-left:4px">${d.createdAt?formatTime(d.createdAt.toDate?d.createdAt.toDate():new Date(d.createdAt)):''}</span>
        </div>
      </div>
    </div>`;
  });
}

async function submitComment(postId, input) {
  if (!input.value.trim()||!currentUser) return;
  const text = input.value.trim();
  input.value = '';
  await db.collection('posts').doc(postId).collection('comments').add({
    text, authorName: currentUser.displayName, authorPhoto: currentUser.photoURL,
    authorUid: currentUser.uid, likes: 0,
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  });
  await db.collection('posts').doc(postId).update({ commentCount: firebase.firestore.FieldValue.increment(1) });
  loadComments(postId);
  const postSnap = await db.collection('posts').doc(postId).get();
  if (postSnap.exists && postSnap.data().authorUid !== currentUser.uid) {
    addNotification(postSnap.data().authorUid, `${currentUser.displayName} আপনার পোস্টে মন্তব্য করেছেন।`, currentUser.photoURL);
  }
}

async function likeComment(postId, commentId) {
  const ref = db.collection('posts').doc(postId).collection('comments').doc(commentId);
  await ref.update({ likes: firebase.firestore.FieldValue.increment(1) });
  loadComments(postId);
}

async function deleteComment(postId, commentId) {
  if (!confirm('মন্তব্যটি মুছবেন?')) return;
  await db.collection('posts').doc(postId).collection('comments').doc(commentId).delete();
  await db.collection('posts').doc(postId).update({ commentCount: firebase.firestore.FieldValue.increment(-1) });
  loadComments(postId);
  showToast('মন্তব্য মুছে ফেলা হয়েছে।');
}

// POST MENU
function togglePostMenu(postId, el) {
  document.querySelectorAll('.post-menu-dropdown').forEach(d => {
    if (d.id !== 'pmenu-'+postId) d.classList.remove('show');
  });
  document.getElementById('pmenu-'+postId)?.classList.toggle('show');
}

async function deletePost(postId) {
  if (!confirm('পোস্টটি মুছবেন?')) return;
  await db.collection('posts').doc(postId).delete();
  document.getElementById('post-'+postId)?.remove();
  showToast('পোস্ট মুছে ফেলা হয়েছে।');
}

async function savePost(postId) {
  if (!currentUser) return;
  await db.collection('users').doc(currentUser.uid).collection('saved').doc(postId).set({ postId, savedAt: firebase.firestore.FieldValue.serverTimestamp() });
  showToast('পোস্ট সেভ করা হয়েছে! 🔖');
}

function copyLink(postId) {
  navigator.clipboard.writeText(window.location.href + '#post-' + postId).catch(()=>{});
  showToast('লিঙ্ক কপি করা হয়েছে!');
}

function reportPost(postId) { showToast('রিপোর্ট পাঠানো হয়েছে।'); }
function viewReactions(postId) {}

// CREATE POST
function openPostModal(type) {
  document.getElementById('postModal').classList.add('show');
  document.getElementById('postText').focus();
  if (type==='photo') document.getElementById('postImageInput').click();
  else if (type==='feeling') openFeelingPicker();
  else if (type==='checkin') addLocation();
}
function closePostModal() {
  document.getElementById('postModal').classList.remove('show');
  document.getElementById('postText').value = '';
  document.getElementById('postImageContainer').style.display = 'none';
  document.getElementById('postImagePreview').src = '';
  document.getElementById('feelingDisplay').style.display = 'none';
  selectedImageBase64 = null; selectedImageFile = null; selectedFeeling = null;
}
function removePostImage() {
  selectedImageBase64 = null; selectedImageFile = null;
  document.getElementById('postImageContainer').style.display = 'none';
  document.getElementById('postImageInput').value = '';
}

function previewImage(input) {
  const file = input.files[0];
  if (!file) return;
  selectedImageFile = file;
  const reader = new FileReader();
  reader.onload = e => {
    selectedImageBase64 = e.target.result;
    document.getElementById('postImagePreview').src = e.target.result;
    document.getElementById('postImageContainer').style.display = 'block';
  };
  reader.readAsDataURL(file);
}

async function submitPost() {
  const text = document.getElementById('postText').value.trim();
  if (!text && !selectedImageBase64) { showToast('কিছু লিখুন বা ছবি যোগ করুন।'); return; }
  if (!currentUser) return;
  const btn = document.getElementById('postBtn');
  btn.disabled = true; btn.textContent = 'পোস্ট হচ্ছে...';
  try {
    let imageUrl = selectedImageBase64 || null;
    await db.collection('posts').add({
      text, imageUrl: imageUrl||null, feeling: selectedFeeling||null,
      authorUid: currentUser.uid, authorName: currentUser.displayName,
      authorPhoto: currentUser.photoURL,
      likes: 0, likedBy: {}, reactions: {}, commentCount: 0, shareCount: 0,
      audience: document.getElementById('postAudience').value,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    await db.collection('users').doc(currentUser.uid).update({ postCount: firebase.firestore.FieldValue.increment(1) });
    closePostModal();
    showToast('পোস্ট সফলভাবে শেয়ার হয়েছে! ✅');
  } catch(e) { showToast('পোস্ট ব্যর্থ: '+e.message); }
  btn.disabled = false; btn.textContent = 'পোস্ট করুন';
}

// FEELING
function setupFeelingPicker() {
  const list = document.getElementById('feelingList');
  list.innerHTML = '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">' +
    FEELINGS.map(f=>`<div onclick="selectFeeling('${f.emoji}','${f.text}')" style="display:flex;align-items:center;gap:10px;padding:10px;border-radius:var(--radius);cursor:pointer;transition:.15s" onmouseenter="this.style.background='var(--hover)'" onmouseleave="this.style.background='transparent'">
      <span style="font-size:1.4rem">${f.emoji}</span>
      <span style="font-weight:500">${f.text} অনুভব করছি</span>
    </div>`).join('') + '</div>';
}
function openFeelingPicker() {
  document.getElementById('feelingModal').classList.add('show');
}
function selectFeeling(emoji, text) {
  selectedFeeling = `${emoji} ${text} অনুভব করছি`;
  document.getElementById('feelingDisplay').textContent = selectedFeeling;
  document.getElementById('feelingDisplay').style.display = 'block';
  document.getElementById('feelingModal').classList.remove('show');
}

// LOCATION
function addLocation() {
  if (!navigator.geolocation) { showToast('লোকেশন সমর্থিত নয়।'); return; }
  navigator.geolocation.getCurrentPosition(pos => {
    showToast(`📍 লোকেশন যোগ হয়েছে।`);
  }, ()=>showToast('লোকেশন পাওয়া যায়নি।'));
}

// SHARE
function openShareModal(postId) {
  selectedPostId = postId;
  document.getElementById('shareModal').classList.add('show');
}
async function shareToFeed() {
  if (!selectedPostId || !currentUser) return;
  await db.collection('posts').doc(selectedPostId).update({ shareCount: firebase.firestore.FieldValue.increment(1) });
  document.getElementById('shareModal').classList.remove('show');
  showToast('পোস্ট শেয়ার করা হয়েছে!');
}
function copyPostLink() {
  copyLink(selectedPostId);
  document.getElementById('shareModal').classList.remove('show');
}
function shareViaMessage() {
  document.getElementById('shareModal').classList.remove('show');
  showToast('বার্তায় শেয়ার শীঘ্রই আসছে।');
}

// ======== STORIES ========
async function loadStories() {
  const container = document.getElementById('storiesContainer');
  if (!container) return;
  container.innerHTML = '';
  try {
    const cutoff = new Date(Date.now() - 24*60*60*1000);
    const snap = await db.collection('stories').orderBy('createdAt','desc').limit(20).get();
    const byUser = {};
    snap.forEach(doc => {
      const d = doc.data();
      const created = d.createdAt ? (d.createdAt.toDate ? d.createdAt.toDate() : new Date(d.createdAt)) : new Date();
      if (created < cutoff) return;
      if (!byUser[d.authorUid]) byUser[d.authorUid] = [];
      byUser[d.authorUid].push({ id: doc.id, ...d });
    });
    Object.entries(byUser).forEach(([uid, stories]) => {
      const first = stories[stories.length-1];
      const photo = first.authorPhoto || avatar(first.authorName);
      const thumb = stories.find(s=>s.imageUrl)?.imageUrl || '';
      const card = document.createElement('div');
      card.className = 'story-card';
      card.onclick = () => openStoryViewer(stories.reverse());
      card.innerHTML = `
        ${thumb ? `<img src="${thumb}" alt="">` : `<div style="width:100%;height:100%;background:${first.background||'#1877f2'};display:flex;align-items:center;justify-content:center;color:#fff;padding:10px;font-size:.8rem;text-align:center;">${esc((first.text||'').slice(0,60))}</div>`}
        <div class="story-avatar-ring"><img src="${photo}" alt=""></div>
        <div class="story-label">${esc(first.authorName||'')}</div>
      `;
      container.appendChild(card);
    });
  } catch(e) { /* silent */ }
}

function closeStoryModal() {
  document.getElementById('storyModal').classList.remove('show');
  document.getElementById('storyTextInput').style.display = 'none';
  document.getElementById('storyModalFooter').style.display = 'none';
  document.getElementById('storyPreviewImg').style.display = 'none';
  document.getElementById('storyTextContent').value = '';
  selectedStoryFile = null; selectedStoryType = null;
}

function openStoryType(type) {
  selectedStoryType = type;
  if (type==='photo') document.getElementById('storyImageInput').click();
  else {
    document.getElementById('storyTextInput').style.display = 'block';
    document.getElementById('storyModalFooter').style.display = 'block';
  }
}
function setStoryBg(bg) { selectedStoryBg = bg; }

function previewStory(input) {
  const file = input.files[0];
  if (!file) return;
  selectedStoryFile = file;
  const reader = new FileReader();
  reader.onload = e => {
    const img = document.getElementById('storyPreviewImg');
    img.src = e.target.result; img.style.display = 'block';
    document.getElementById('storyModalFooter').style.display = 'block';
  };
  reader.readAsDataURL(file);
}

async function submitStory() {
  if (!currentUser) return;
  const payload = {
    authorUid: currentUser.uid, authorName: currentUser.displayName, authorPhoto: currentUser.photoURL,
    views: 0, createdAt: firebase.firestore.FieldValue.serverTimestamp()
  };
  if (selectedStoryType === 'photo') {
    const preview = document.getElementById('storyPreviewImg');
    if (!preview.src) { showToast('একটি ছবি বাছাই করুন।'); return; }
    payload.imageUrl = preview.src;
  } else {
    const text = document.getElementById('storyTextContent').value.trim();
    if (!text) { showToast('কিছু লিখুন।'); return; }
    payload.text = text;
    payload.background = selectedStoryBg;
  }
  try {
    await db.collection('stories').add(payload);
    closeStoryModal();
    loadStories();
    showToast('স্টোরি শেয়ার করা হয়েছে! ✅');
  } catch(e) { showToast('ব্যর্থ: ' + e.message); }
}

function openStoryViewer(stories) {
  currentStories = stories;
  currentStoryIndex = 0;
  document.getElementById('storyViewer').classList.add('show');
  renderStorySlide();
  startStoryTimer();
}

function closeStoryViewer() {
  clearInterval(storyTimer);
  clearTimeout(storyTimer);
  document.getElementById('storyViewer').classList.remove('show');
  currentStories = []; currentStoryIndex = 0;
}

function nextStory() {
  if (currentStoryIndex < currentStories.length - 1) {
    currentStoryIndex++;
    renderStorySlide();
    startStoryTimer();
  } else {
    closeStoryViewer();
  }
}

function prevStory() {
  if (currentStoryIndex > 0) {
    currentStoryIndex--;
    renderStorySlide();
    startStoryTimer();
  }
}

function renderStorySlide() {
  const story = currentStories[currentStoryIndex];
  if (!story) { closeStoryViewer(); return; }
  document.getElementById('storyViewerAvatar').src = story.authorPhoto||avatar(story.authorName);
  document.getElementById('storyViewerName').textContent = story.authorName||'';
  document.getElementById('storyViewerTime').textContent = story.createdAt ? formatTime(story.createdAt.toDate?story.createdAt.toDate():new Date(story.createdAt)) : '';
  const content = document.getElementById('storyViewerContent');
  if (story.imageUrl) {
    content.innerHTML = `<div class="story-content"><img src="${story.imageUrl}" alt=""></div>`;
  } else {
    content.innerHTML = `<div class="story-text-content" style="background:${story.background||'#1877f2'}">${esc(story.text||'')}</div>`;
  }
  const bars = document.getElementById('storyProgressBars');
  bars.innerHTML = currentStories.map((_, i) => `
    <div class="story-progress-bar">
      <div class="story-progress-fill" id="spf-${i}" style="width:${i<currentStoryIndex?100:0}%"></div>
    </div>`).join('');
  if (story.id) db.collection('stories').doc(story.id).update({ views: firebase.firestore.FieldValue.increment(1) }).catch(()=>{});
}

function startStoryTimer() {
  clearInterval(storyTimer);
  clearTimeout(storyTimer);
  const duration = 5000;
  const fill = document.getElementById('spf-'+currentStoryIndex);
  if (fill) { requestAnimationFrame(()=>{ fill.style.transition = `width ${duration}ms linear`; fill.style.width = '100%'; }); }
  storyTimer = setTimeout(() => nextStory(), duration);
}

// ======== ONLINE FRIENDS ========
async function loadOnlineFriends() {
  const snap = await rtdb.ref('online').once('value');
  const onlineUids = Object.keys(snap.val()||{});
  const container = document.getElementById('onlineFriends');
  container.innerHTML = '';
  if (!onlineUids.length) { container.innerHTML = '<div style="font-size:.88rem;color:var(--text-secondary);padding:6px 4px">কেউ অনলাইনে নেই</div>'; return; }
  for (const uid of onlineUids.slice(0,8)) {
    if (uid===currentUser?.uid) continue;
    try {
      const u = await db.collection('users').doc(uid).get();
      if (!u.exists) continue;
      const d = u.data();
      const p = d.photo||avatar(d.name);
      container.innerHTML += `<div class="friend-item" onclick="openChatWithUser('${uid}','${esc(d.name||'')}','${p}')">
        <div style="position:relative">
          <img src="${p}" alt="" style="width:36px;height:36px;border-radius:50%">
          <div class="online-dot" style="position:absolute;bottom:0;right:0"></div>
        </div>
        <span class="friend-name">${esc(d.name||'ব্যবহারকারী')}</span>
      </div>`;
    } catch(e) {}
  }
  if (!container.innerHTML) container.innerHTML = '<div style="font-size:.88rem;color:var(--text-secondary);padding:6px 4px">আপনি ছাড়া কেউ অনলাইনে নেই</div>';
}

// ======== PEOPLE YOU MAY KNOW ========
async function loadPeopleYouMayKnow() {
  const container = document.getElementById('pymkWidget');
  container.innerHTML = '';
  try {
    const snap = await db.collection('users').limit(6).get();
    snap.forEach(doc => {
      if (doc.id === currentUser?.uid) return;
      const d = doc.data();
      const p = d.photo||avatar(d.name);
      container.innerHTML += `<div class="pymk-item">
        <img src="${p}" alt="" onclick="viewProfile('${doc.id}')" style="cursor:pointer">
        <div class="pymk-info">
          <div class="pymk-name" onclick="viewProfile('${doc.id}')">${esc(d.name||'ব্যবহারকারী')}</div>
          <div class="pymk-mutual">${d.city||'post.com সদস্য'}</div>
        </div>
        <button class="btn-add-friend" id="pymk-btn-${doc.id}" onclick="sendFriendRequest('${doc.id}','${esc(d.name||'')}',this)"><i class="fas fa-user-plus"></i> যোগ করুন</button>
      </div>`;
    });
  } catch(e) {}
}

// ======== BIRTHDAYS ========
async function loadBirthdays() {
  const widget = document.getElementById('birthdayWidget');
  try {
    const today = new Date();
    const mmdd = String(today.getMonth()+1).padStart(2,'0') + '-' + String(today.getDate()).padStart(2,'0');
    const snap = await db.collection('users').limit(50).get();
    const todays = [];
    snap.forEach(doc => {
      const d = doc.data();
      if (d.birthday && d.birthday.slice(5) === mmdd && doc.id !== currentUser?.uid) todays.push(d);
    });
    if (!todays.length) { widget.textContent = 'আজ কারো জন্মদিন নেই।'; return; }
    widget.innerHTML = todays.map(d => `<div style="padding:4px 0">🎂 <strong>${esc(d.name)}</strong>-এর আজ জন্মদিন!</div>`).join('');
  } catch(e) { widget.textContent = 'লোড করা যায়নি।'; }
}

// ======== FRIEND REQUESTS ========
async function loadFriendRequests() {
  if (!currentUser) return;
  const snap = await db.collection('friendRequests').where('to','==',currentUser.uid).where('status','==','pending').get();
  const badge = document.getElementById('freqBadge');
  if (snap.size > 0) { badge.textContent = snap.size; badge.style.display = 'flex'; }
  else badge.style.display = 'none';
  const list = document.getElementById('freqList');
  list.innerHTML = '';
  if (snap.empty) { list.innerHTML = '<div style="font-size:.9rem;color:var(--text-secondary);padding:8px">কোনো বন্ধু অনুরোধ নেই।</div>'; return; }
  snap.forEach(doc => {
    const d = doc.data();
    const p = d.fromPhoto||avatar(d.fromName);
    list.innerHTML += `<div class="pymk-item">
      <img src="${p}" alt="" onclick="viewProfile('${d.from}')" style="cursor:pointer">
      <div class="pymk-info">
        <div class="pymk-name" onclick="viewProfile('${d.from}')">${esc(d.fromName||'')}</div>
        <div class="pymk-mutual">বন্ধু অনুরোধ পাঠিয়েছেন</div>
      </div>
      <div style="display:flex;flex-direction:column;gap:4px">
        <button class="btn-confirm" onclick="acceptFriendRequest('${doc.id}','${d.from}','${esc(d.fromName||'')}')">গ্রহণ</button>
        <button class="btn-delete" onclick="rejectFriendRequest('${doc.id}')">প্রত্যাখ্যান</button>
      </div>
    </div>`;
  });
}

async function sendFriendRequest(toUid, toName, btn) {
  if (!currentUser) return;
  const existing = await db.collection('friendRequests')
    .where('from','==',currentUser.uid).where('to','==',toUid).get();
  if (!existing.empty) { showToast('ইতিমধ্যে অনুরোধ পাঠানো হয়েছে।'); return; }
  await db.collection('friendRequests').add({
    from: currentUser.uid, fromName: currentUser.displayName, fromPhoto: currentUser.photoURL,
    to: toUid, toName: toName, status: 'pending',
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  });
  addNotification(toUid, `${currentUser.displayName} বন্ধু অনুরোধ পাঠিয়েছেন।`, currentUser.photoURL);
  if (btn) { btn.textContent = 'পাঠানো হয়েছে'; btn.classList.add('sent'); btn.disabled = true; }
  showToast('বন্ধু অনুরোধ পাঠানো হয়েছে! 👋');
}

async function acceptFriendRequest(reqId, fromUid, fromName) {
  await db.collection('friendRequests').doc(reqId).update({ status: 'accepted' });
  await db.collection('users').doc(currentUser.uid).collection('friends').doc(fromUid).set({ uid: fromUid, name: fromName, since: firebase.firestore.FieldValue.serverTimestamp() });
  await db.collection('users').doc(fromUid).collection('friends').doc(currentUser.uid).set({ uid: currentUser.uid, name: currentUser.displayName, since: firebase.firestore.FieldValue.serverTimestamp() });
  await db.collection('users').doc(currentUser.uid).update({ friendCount: firebase.firestore.FieldValue.increment(1) });
  await db.collection('users').doc(fromUid).update({ friendCount: firebase.firestore.FieldValue.increment(1) });
  addNotification(fromUid, `${currentUser.displayName} আপনার বন্ধু অনুরোধ গ্রহণ করেছেন।`, currentUser.photoURL);
  loadFriendRequests();
  showToast('বন্ধু অনুরোধ গ্রহণ করা হয়েছে! 🎉');
}

async function rejectFriendRequest(reqId) {
  await db.collection('friendRequests').doc(reqId).update({ status: 'rejected' });
  loadFriendRequests();
  showToast('বন্ধু অনুরোধ প্রত্যাখ্যান করা হয়েছে।');
}

function toggleFriendReqs() {
  const p = document.getElementById('freqPanel');
  const isShowing = p.classList.toggle('show');
  document.getElementById('notifPanel').classList.remove('show');
  document.getElementById('profileDropdown').classList.remove('show');
  document.getElementById('freqBadge').style.display = 'none';
  if (isShowing) loadFreqPanel();
}

async function loadFreqPanel() {
  if (!currentUser) return;
  const list = document.getElementById('freqList');
  list.innerHTML = '<div style="padding:12px;color:var(--text-secondary);font-size:.9rem">লোড হচ্ছে...</div>';
  try {
    const snap = await db.collection('friendRequests')
      .where('to','==',currentUser.uid).where('status','==','pending').get();
    if (snap.empty) {
      list.innerHTML = '<div style="padding:16px;color:var(--text-secondary);font-size:.9rem;text-align:center"><i class="fas fa-user-friends" style="font-size:1.8rem;opacity:.3;display:block;margin-bottom:8px"></i>কোনো বন্ধু অনুরোধ নেই।</div>';
      return;
    }
    list.innerHTML = '';
    snap.forEach(doc => {
      const d = doc.data();
      const ph = d.fromPhoto || avatar(d.fromName);
      const div = document.createElement('div');
      div.style.cssText = 'display:flex;align-items:center;gap:10px;padding:10px 12px;border-bottom:1px solid var(--border);';
      div.innerHTML = `
        <img src="${esc(ph)}" onclick="viewProfile('${d.from}')" style="width:46px;height:46px;border-radius:50%;object-fit:cover;cursor:pointer;flex-shrink:0;">
        <div style="flex:1;min-width:0;">
          <div style="font-weight:600;font-size:.92rem;cursor:pointer;" onclick="viewProfile('${d.from}')">${esc(d.fromName||'')}</div>
          <div style="font-size:.78rem;color:var(--text-secondary);margin-bottom:6px;">বন্ধু অনুরোধ পাঠিয়েছেন</div>
          <div style="display:flex;gap:6px;">
            <button onclick="acceptFriendRequest('${doc.id}','${d.from}','${esc(d.fromName||'')}');this.closest('div').parentElement.parentElement.remove()"
              style="flex:1;background:var(--primary);color:#fff;border:none;border-radius:6px;padding:6px;font-size:.82rem;cursor:pointer;font-family:inherit;">গ্রহণ</button>
            <button onclick="rejectFriendRequest('${doc.id}');this.closest('div').parentElement.parentElement.remove()"
              style="flex:1;background:var(--bg);color:var(--text);border:none;border-radius:6px;padding:6px;font-size:.82rem;cursor:pointer;font-family:inherit;">মুছুন</button>
          </div>
        </div>`;
      list.appendChild(div);
    });
  } catch(e) {
    list.innerHTML = '<div style="padding:12px;color:red;font-size:.82rem">লোড ব্যর্থ: '+e.message+'</div>';
  }
}

// ======== FRIENDS PAGE ========
async function loadFriendsPage() {
  const container = document.getElementById('friendsContent');
  container.innerHTML = '<div class="loader"><div class="spinner"></div>লোড হচ্ছে...</div>';

  const reqSnap = await db.collection('friendRequests').where('to','==',currentUser.uid).where('status','==','pending').get();
  let reqHtml = '';
  if (!reqSnap.empty) {
    reqHtml = `<div class="friend-req-card"><div class="freq-header">বন্ধু অনুরোধ (${reqSnap.size})</div><div class="freq-grid">`;
    reqSnap.forEach(doc => {
      const d = doc.data();
      const p = d.fromPhoto||avatar(d.fromName);
      reqHtml += `<div class="freq-item">
        <img src="${p}" alt="" onclick="viewProfile('${d.from}')" style="cursor:pointer">
        <div class="freq-item-info">
          <div class="freq-item-name">${esc(d.fromName||'')}</div>
          <div class="freq-btns">
            <button class="btn-confirm" onclick="acceptFriendRequest('${doc.id}','${d.from}','${esc(d.fromName||'')}')">গ্রহণ</button>
            <button class="btn-delete" onclick="rejectFriendRequest('${doc.id}')">মুছুন</button>
          </div>
        </div>
      </div>`;
    });
    reqHtml += '</div></div>';
  }

  const usersSnap = await db.collection('users').limit(12).get();
  let pymkHtml = '<div class="friend-req-card"><div class="freq-header">পরিচিত মানুষ</div><div class="freq-grid">';
  usersSnap.forEach(doc => {
    if (doc.id === currentUser.uid) return;
    const d = doc.data();
    const p = d.photo||avatar(d.name);
    pymkHtml += `<div class="freq-item">
      <img src="${p}" alt="" onclick="viewProfile('${doc.id}')" style="cursor:pointer">
      <div class="freq-item-info">
        <div class="freq-item-name">${esc(d.name||'ব্যবহারকারী')}</div>
        <div class="freq-item-mutual">${d.city||'post.com সদস্য'}</div>
        <div class="freq-btns">
          <button class="btn-confirm" id="frnd-${doc.id}" onclick="sendFriendRequest('${doc.id}','${esc(d.name||'')}',this)"><i class="fas fa-user-plus"></i> যোগ করুন</button>
          <button class="btn-delete" onclick="viewProfile('${doc.id}')">প্রোফাইল</button>
        </div>
      </div>
    </div>`;
  });
  pymkHtml += '</div></div>';

  container.innerHTML = reqHtml + pymkHtml;
}

// ======== PROFILE PAGE ========
async function viewProfile(uid) {
  if (!uid) return;
  document.getElementById('mainApp').style.display = 'none';
  document.getElementById('messagesPage').style.display = 'none';
  document.getElementById('profilePage').style.display = 'block';
  window.scrollTo(0,0);
  currentProfile = uid;

  const snap = await db.collection('users').doc(uid).get();
  const d = snap.exists ? snap.data() : {};
  const photo = d.photo||avatar(d.name);
  const isMine = uid === currentUser?.uid;

  document.getElementById('profileAvatar').src = photo;
  document.getElementById('profilePageName').textContent = d.name||'ব্যবহারকারী';
  document.getElementById('profilePageBio').textContent = d.bio||'বায়ো যোগ করুন...';
  document.getElementById('profileStats').innerHTML = `
    <span class="profile-stat"><strong>${d.friendCount||0}</strong> বন্ধু</span>
    <span class="profile-stat"><strong>${d.postCount||0}</strong> পোস্ট</span>
  `;

  const coverImg = document.getElementById('profileCoverImg');
  if (d.coverPhoto) { coverImg.src = d.coverPhoto; coverImg.style.display='block'; document.getElementById('profileCoverPlaceholder').style.display='none'; }
  else { coverImg.style.display='none'; document.getElementById('profileCoverPlaceholder').style.display='block'; }

  const actions = document.getElementById('profileActions');
  if (isMine) {
    actions.innerHTML = `<button class="btn-edit-profile" onclick="openEditProfile()"><i class="fas fa-edit"></i> প্রোফাইল সম্পাদনা</button>`;
    document.getElementById('coverEditBtn').style.display = 'flex';
    document.getElementById('avatarEditBtn').style.display = 'flex';
  } else {
    actions.innerHTML = `<button class="btn-message" onclick="openChatWithUser('${uid}','${esc(d.name||'')}','${photo}')"><i class="fas fa-comment-dots"></i> বার্তা পাঠান</button>
      <button class="btn-edit-profile" id="addFriendBtn-${uid}" onclick="sendFriendRequest('${uid}','${esc(d.name||'')}',this)"><i class="fas fa-user-plus"></i> বন্ধু যোগ করুন</button>`;
    document.getElementById('coverEditBtn').style.display = 'none';
    document.getElementById('avatarEditBtn').style.display = 'none';
  }

  const about = document.getElementById('profileAboutContent');
  about.innerHTML = [
    d.bio ? `<div class="profile-about-item"><i class="fas fa-quote-left"></i> ${esc(d.bio)}</div>` : '',
    d.work ? `<div class="profile-about-item"><i class="fas fa-briefcase"></i> ${esc(d.work)}-এ কর্মরত</div>` : '',
    d.education ? `<div class="profile-about-item"><i class="fas fa-graduation-cap"></i> ${esc(d.education)}</div>` : '',
    d.city ? `<div class="profile-about-item"><i class="fas fa-map-marker-alt"></i> ${esc(d.city)}-এ বাস করেন</div>` : '',
    d.website ? `<div class="profile-about-item"><i class="fas fa-globe"></i> <a href="${esc(d.website)}" target="_blank" style="color:var(--primary)">${esc(d.website)}</a></div>` : '',
    d.birthday ? `<div class="profile-about-item"><i class="fas fa-birthday-cake"></i> ${esc(d.birthday)}</div>` : '',
    `<div class="profile-about-item"><i class="fas fa-calendar"></i> ${d.createdAt ? formatTime(d.createdAt.toDate?d.createdAt.toDate():new Date(d.createdAt)) : ''} যোগ দিয়েছেন</div>`
  ].join('');

  const photosGrid = document.getElementById('profilePhotosGrid');
  const postSnap = await db.collection('posts').where('authorUid','==',uid).orderBy('createdAt','desc').limit(9).get();
  photosGrid.innerHTML = '';
  postSnap.forEach(doc => {
    const pd = doc.data();
    if (pd.imageUrl) photosGrid.innerHTML += `<div class="profile-photo-thumb" onclick="openLightbox('${pd.imageUrl}')"><img src="${pd.imageUrl}" alt=""></div>`;
  });

  const pfeed = document.getElementById('profileFeedContainer');
  pfeed.innerHTML = '';
  if (isMine) {
    pfeed.innerHTML += `<div class="create-post" style="margin-bottom:16px">
      <div class="cp-top"><img src="${photo}" class="cp-avatar" alt=""><button class="cp-input" onclick="openPostModal()">আপনার মনে কী আছে?</button></div>
    </div>`;
  }
  postSnap.forEach(doc => renderPost({ id: doc.id, ...doc.data() }, false, pfeed));
  if (postSnap.empty) pfeed.innerHTML += '<div class="loader" style="color:var(--text-secondary)">কোনো পোস্ট নেই।</div>';

  // reset to posts tab
  document.querySelectorAll('.profile-tab').forEach((t,i)=>t.classList.toggle('active', i===0));
  document.getElementById('profileAboutCard').style.display = 'none';
  document.getElementById('profilePhotosCard').style.display = 'none';
  pfeed.style.display = 'block';
}

function switchProfileTab(tab, el) {
  document.querySelectorAll('.profile-tab').forEach(t=>t.classList.remove('active'));
  el.classList.add('active');
  const uid = currentProfile;
  const pfeed = document.getElementById('profileFeedContainer');
  const aboutCard = document.getElementById('profileAboutCard');
  const photosCard = document.getElementById('profilePhotosCard');

  pfeed.style.display = 'none';
  if(aboutCard) aboutCard.style.display = 'none';
  if(photosCard) photosCard.style.display = 'none';

  if(tab === 'posts') {
    pfeed.style.display = 'block';
  } else if(tab === 'about') {
    if(aboutCard) aboutCard.style.display = 'block';
  } else if(tab === 'photos') {
    if(photosCard) photosCard.style.display = 'block';
    loadProfilePhotos(uid);
  } else if(tab === 'friends') {
    pfeed.style.display = 'block';
    loadProfileFriends(uid);
  }
}

async function loadProfilePhotos(uid) {
  const grid = document.getElementById('profilePhotosGrid');
  if(!grid) return;
  grid.innerHTML = '<div style="color:var(--text-secondary);font-size:.85rem;padding:8px">লোড হচ্ছে...</div>';
  try {
    const snap = await db.collection('posts').where('authorUid','==',uid).limit(20).get();
    grid.innerHTML = '';
    let count = 0;
    snap.forEach(doc => {
      const d = doc.data();
      if(!d.imageUrl) return;
      count++;
      const div = document.createElement('div');
      div.className = 'profile-photo-thumb';
      div.innerHTML = `<img src="${d.imageUrl}" alt="">`;
      div.onclick = () => openLightbox(d.imageUrl);
      grid.appendChild(div);
    });
    if(!count) grid.innerHTML = '<div style="color:var(--text-secondary);font-size:.85rem;padding:8px">কোনো ছবি নেই।</div>';
  } catch(e) {
    grid.innerHTML = '<div style="color:var(--text-secondary);font-size:.8rem;padding:8px">ছবি নেই অথবা লোড ব্যর্থ।</div>';
  }
}

async function loadProfileFriends(uid) {
  const pfeed = document.getElementById('profileFeedContainer');
  pfeed.innerHTML = '<div class="loader"><div class="spinner"></div>লোড হচ্ছে...</div>';
  try {
    const snap = await db.collection('users').doc(uid).collection('friends').limit(20).get();
    if(snap.empty) { pfeed.innerHTML = '<div style="padding:30px;text-align:center;color:var(--text-secondary)"><i class="fas fa-user-friends" style="font-size:2rem;opacity:.3;display:block;margin-bottom:10px;"></i>কোনো বন্ধু নেই।</div>'; return; }
    let html = '<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:10px;padding:4px;">';
    for (const doc of snap.docs) {
      const fuid = doc.data().uid;
      const uSnap = await db.collection('users').doc(fuid).get();
      if (!uSnap.exists) continue;
      const d = uSnap.data();
      const ph = d.photo || avatar(d.name);
      html += `<div class="friend-card">
        <img src="${ph}" alt="" onclick="viewProfile('${fuid}')" style="cursor:pointer">
        <div class="friend-card-info">
          <div class="friend-card-name" onclick="viewProfile('${fuid}')">${esc(d.name||'ব্যবহারকারী')}</div>
        </div>
      </div>`;
    }
    html += '</div>';
    pfeed.innerHTML = html;
  } catch(e) {
    pfeed.innerHTML = '<div style="padding:20px;color:red;font-size:.85rem">বন্ধু তালিকা লোড ব্যর্থ: ' + esc(e.message) + '</div>';
  }
}

// ======== EDIT PROFILE ========
async function openEditProfile() {
  if (!currentUser) return;
  const snap = await db.collection('users').doc(currentUser.uid).get();
  const d = snap.exists ? snap.data() : {};
  document.getElementById('editName').value = d.name || '';
  document.getElementById('editBio').value = d.bio || '';
  document.getElementById('editCity').value = d.city || '';
  document.getElementById('editWork').value = d.work || '';
  document.getElementById('editEducation').value = d.education || '';
  document.getElementById('editBirthday').value = d.birthday || '';
  document.getElementById('editWebsite').value = d.website || '';
  document.getElementById('editProfileModal').classList.add('show');
}

async function saveProfile() {
  if (!currentUser) return;
  const data = {
    name: document.getElementById('editName').value.trim(),
    bio: document.getElementById('editBio').value.trim(),
    city: document.getElementById('editCity').value.trim(),
    work: document.getElementById('editWork').value.trim(),
    education: document.getElementById('editEducation').value.trim(),
    birthday: document.getElementById('editBirthday').value,
    website: document.getElementById('editWebsite').value.trim()
  };
  try {
    await db.collection('users').doc(currentUser.uid).update(data);
    document.getElementById('editProfileModal').classList.remove('show');
    document.getElementById('leftName').textContent = data.name;
    document.getElementById('cpName').textContent = data.name.split(' ')[0];
    document.getElementById('modalName').textContent = data.name;
    document.getElementById('pdName').textContent = data.name;
    if (currentProfile === currentUser.uid) viewProfile(currentUser.uid);
    showToast('প্রোফাইল আপডেট হয়েছে! ✅');
  } catch(e) { showToast('সংরক্ষণ ব্যর্থ: ' + e.message); }
}

function changeAvatar() {
  const input = document.createElement('input');
  input.type = 'file'; input.accept = 'image/*';
  input.onchange = async () => {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async e => {
      await db.collection('users').doc(currentUser.uid).update({ photo: e.target.result });
      document.getElementById('profileAvatar').src = e.target.result;
      ['navAvatar','pdAvatar','cpAvatar','modalAvatar','leftAvatar','storyMeAvatar'].forEach(id => {
        const el = document.getElementById(id); if (el) el.src = e.target.result;
      });
      showToast('প্রোফাইল ছবি পরিবর্তন হয়েছে!');
    };
    reader.readAsDataURL(file);
  };
  input.click();
}

function changeCoverPhoto() {
  const input = document.createElement('input');
  input.type = 'file'; input.accept = 'image/*';
  input.onchange = async () => {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async e => {
      await db.collection('users').doc(currentUser.uid).update({ coverPhoto: e.target.result });
      const img = document.getElementById('profileCoverImg');
      img.src = e.target.result; img.style.display = 'block';
      document.getElementById('profileCoverPlaceholder').style.display = 'none';
      showToast('কভার ফটো পরিবর্তন হয়েছে!');
    };
    reader.readAsDataURL(file);
  };
  input.click();
}

// ======== NOTIFICATIONS ========
async function addNotification(toUid, text, fromPhoto) {
  if (!toUid || toUid === currentUser?.uid) return;
  await db.collection('users').doc(toUid).collection('notifications').add({
    text, photo: fromPhoto || '', read: false,
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  });
}

async function loadNotifications() {
  if (!currentUser) return;
  db.collection('users').doc(currentUser.uid).collection('notifications')
    .orderBy('createdAt','desc').limit(20)
    .onSnapshot(snap => {
      const list = document.getElementById('notifList');
      list.innerHTML = '';
      let unread = 0;
      if (snap.empty) { list.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text-secondary);font-size:.9rem">কোনো বিজ্ঞপ্তি নেই।</div>'; }
      snap.forEach(doc => {
        const d = doc.data();
        if (!d.read) unread++;
        const time = d.createdAt ? formatTime(d.createdAt.toDate ? d.createdAt.toDate() : new Date(d.createdAt)) : '';
        list.innerHTML += `<div class="notif-item ${d.read?'':'unread'}" onclick="markNotifRead('${doc.id}')">
          <img src="${d.photo||avatar('U')}" alt="">
          <div class="notif-text">${esc(d.text)}<div class="notif-time">${time}</div></div>
          ${!d.read?'<div class="notif-dot"></div>':''}
        </div>`;
      });
      const badge = document.getElementById('notifBadge');
      const mBadge = document.getElementById('mobileNotifBadge');
      if (unread > 0) { badge.textContent = unread; badge.style.display='flex'; if(mBadge){mBadge.textContent=unread;mBadge.style.display='flex';} }
      else { badge.style.display='none'; if(mBadge) mBadge.style.display='none'; }
    });
}

async function markNotifRead(id) {
  if (!currentUser) return;
  await db.collection('users').doc(currentUser.uid).collection('notifications').doc(id).update({ read: true });
}

async function markAllRead() {
  if (!currentUser) return;
  const snap = await db.collection('users').doc(currentUser.uid).collection('notifications').where('read','==',false).get();
  const batch = db.batch();
  snap.forEach(doc => batch.update(doc.ref, { read: true }));
  await batch.commit();
}

function toggleNotif() {
  const p = document.getElementById('notifPanel');
  const isShowing = p.classList.toggle('show');
  document.getElementById('freqPanel').classList.remove('show');
  document.getElementById('profileDropdown').classList.remove('show');
}

function toggleProfile() {
  const p = document.getElementById('profileDropdown');
  p.classList.toggle('show');
  document.getElementById('notifPanel').classList.remove('show');
  document.getElementById('freqPanel').classList.remove('show');
}

function toggleDarkMode(on) {
  document.body.style.filter = on ? 'invert(1) hue-rotate(180deg)' : '';
  showToast(on ? 'ডার্ক মোড চালু হয়েছে' : 'ডার্ক মোড বন্ধ হয়েছে');
}

// ======== LIGHTBOX ========
function openLightbox(src) {
  document.getElementById('lightboxImg').src = src;
  document.getElementById('imageLightbox').classList.add('show');
}
function closeLightbox() {
  document.getElementById('imageLightbox').classList.remove('show');
}

// ======== MESSAGING ========
function chatId(a, b) { return [a,b].sort().join('_'); }

function openMsgPage() {
  document.getElementById('mainApp').style.display = 'none';
  document.getElementById('profilePage').style.display = 'none';
  document.getElementById('messagesPage').style.display = 'block';
  loadMsgThreads();
}
function closeMsgPage() {
  document.getElementById('messagesPage').style.display = 'none';
  document.getElementById('msgChatBox').style.display = 'none';
  showMainApp();
}
function closeMsgChat() {
  document.getElementById('msgChatBox').style.display = 'none';
  if (chatUnsub) { chatUnsub(); chatUnsub = null; }
  msgPeerId = null;
}

async function loadMsgThreads() {
  if (!currentUser) return;
  const list = document.getElementById('msgList');
  list.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text-secondary);font-size:.9rem;">লোড হচ্ছে...</div>';
  if (msgListUnsub) msgListUnsub();
  msgListUnsub = db.collection('users').doc(currentUser.uid).collection('threads')
    .orderBy('updatedAt','desc').limit(30)
    .onSnapshot(async snap => {
      list.innerHTML = '';
      if (snap.empty) { list.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text-secondary);font-size:.9rem;">কোনো বার্তা নেই।</div>'; return; }
      for (const doc of snap.docs) {
        const d = doc.data();
        const peerId = doc.id;
        const uSnap = await db.collection('users').doc(peerId).get();
        const u = uSnap.exists ? uSnap.data() : { name: d.peerName };
        const photo = u.photo || avatar(u.name);
        const div = document.createElement('div');
        div.style.cssText = 'display:flex;align-items:center;gap:10px;padding:10px 16px;cursor:pointer;';
        div.onmouseenter = () => div.style.background = 'var(--hover)';
        div.onmouseleave = () => div.style.background = 'transparent';
        div.innerHTML = `
          <img src="${photo}" style="width:48px;height:48px;border-radius:50%;object-fit:cover;flex-shrink:0;">
          <div style="flex:1;min-width:0;">
            <div style="font-weight:600;font-size:.92rem;">${esc(u.name||'ব্যবহারকারী')}</div>
            <div style="font-size:.82rem;color:var(--text-secondary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(d.lastMessage||'')}</div>
          </div>`;
        div.onclick = () => openChatWithUser(peerId, u.name, photo);
        list.appendChild(div);
      }
    });
}

function filterMsgList(value) {
  const items = document.getElementById('msgList').children;
  for (const item of items) {
    const name = item.querySelector('div > div')?.textContent || '';
    item.style.display = name.toLowerCase().includes(value.toLowerCase()) ? 'flex' : 'none';
  }
}

function openChatWithUser(uid, name, photo) {
  openChat(uid, name, photo);
}

async function openChat(uid, name, photo) {
  if (!currentUser || !uid) return;
  msgPeerId = uid;
  document.getElementById('messagesPage').style.display = 'none';
  const box = document.getElementById('msgChatBox');
  box.style.cssText = 'display:flex;position:fixed;inset:0;top:var(--navbar-h);z-index:120;background:var(--white);flex-direction:column;overflow:hidden;';
  document.getElementById('msgPeerAv').src = photo || avatar(name);
  document.getElementById('msgPeerName').textContent = name || '';
  document.getElementById('msgPeerStatus').textContent = '';
  document.getElementById('msgBubbles').innerHTML = '<div class="loader"><div class="spinner"></div></div>';

  const online = await rtdb.ref('online/' + uid).once('value');
  document.getElementById('msgOnlineDot').style.display = online.exists() ? 'block' : 'none';
  document.getElementById('msgPeerStatus').textContent = online.exists() ? 'সক্রিয় আছে' : '';

  const cid = chatId(currentUser.uid, uid);
  if (chatUnsub) chatUnsub();
  chatUnsub = db.collection('chats').doc(cid).collection('messages')
    .orderBy('createdAt','asc').limit(100)
    .onSnapshot(snap => {
      const bubbles = document.getElementById('msgBubbles');
      bubbles.innerHTML = '';
      snap.forEach(doc => {
        const d = doc.data();
        const mine = d.from === currentUser.uid;
        const div = document.createElement('div');
        div.style.cssText = `display:flex;justify-content:${mine?'flex-end':'flex-start'};margin-bottom:6px;`;
        div.innerHTML = `<div style="max-width:70%;padding:8px 14px;border-radius:18px;font-size:.9rem;background:${mine?'var(--primary)':'var(--white)'};color:${mine?'#fff':'var(--text)'};box-shadow:${mine?'none':'0 1px 2px rgba(0,0,0,.1)'};">${esc(d.text)}</div>`;
        bubbles.appendChild(div);
      });
      bubbles.scrollTop = bubbles.scrollHeight;
    });
}

async function sendMsgText() {
  const input = document.getElementById('msgInput');
  const text = input.value.trim();
  if (!text || !currentUser || !msgPeerId) return;
  input.value = '';
  const cid = chatId(currentUser.uid, msgPeerId);
  await db.collection('chats').doc(cid).collection('messages').add({
    text, from: currentUser.uid, to: msgPeerId,
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  });
  const now = firebase.firestore.FieldValue.serverTimestamp();
  await db.collection('users').doc(currentUser.uid).collection('threads').doc(msgPeerId).set({ lastMessage: text, updatedAt: now, peerName: '' }, { merge: true });
  await db.collection('users').doc(msgPeerId).collection('threads').doc(currentUser.uid).set({ lastMessage: text, updatedAt: now, peerName: currentUser.displayName }, { merge: true });
  addNotification(msgPeerId, `${currentUser.displayName}: ${text}`, currentUser.photoURL);
}

function sendMsgPhoto() {
  const input = document.createElement('input');
  input.type = 'file'; input.accept = 'image/*';
  input.onchange = async () => {
    const file = input.files[0];
    if (!file || !currentUser || !msgPeerId) return;
    const reader = new FileReader();
    reader.onload = async e => {
      const cid = chatId(currentUser.uid, msgPeerId);
      await db.collection('chats').doc(cid).collection('messages').add({
        text: '📷 ছবি', imageUrl: e.target.result, from: currentUser.uid, to: msgPeerId,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    };
    reader.readAsDataURL(file);
  };
  input.click();
}

function listenIncomingMessages() {
  if (!currentUser) return;
  db.collection('users').doc(currentUser.uid).collection('threads')
    .onSnapshot(snap => {
      const badge = document.getElementById('msgBadge');
      if (snap.size > 0) { badge.textContent = snap.size; badge.style.display='flex'; }
      else badge.style.display = 'none';
    });
}

// ======== VIDEO CALL (placeholder — no signaling backend included) ========
let localStream = null;
function toggleMute() {
  if (!localStream) return;
  const track = localStream.getAudioTracks()[0];
  if (track) track.enabled = !track.enabled;
}
function toggleCamera() {
  if (!localStream) return;
  const track = localStream.getVideoTracks()[0];
  if (track) track.enabled = !track.enabled;
}
function endCall() {
  document.getElementById('videoCallOverlay').classList.remove('show');
  if (localStream) { localStream.getTracks().forEach(t=>t.stop()); localStream = null; }
}

