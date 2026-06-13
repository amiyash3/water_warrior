/**
 * Local-first API — used when VITE_SUPABASE_* env vars are not set.
 */

const STORAGE = {
  currentUserId: 'ww_current_user_id',
  users: 'ww_users',
  posts: 'ww_water_posts',
  bottles: 'ww_user_bottles',
  friendRequests: 'ww_friend_requests',
};

const DEMO_USERS = [
  {
    id: 'demo-alex',
    email: 'alex@waterwarrior.app',
    username: 'alex_h2o',
    full_name: 'Alex Rivera',
    bio: 'Morning hydration enthusiast',
    friends: [],
    daily_goal_ml: 2500,
    streak_count: 5,
  },
  {
    id: 'demo-sam',
    email: 'sam@waterwarrior.app',
    username: 'sam_sips',
    full_name: 'Sam Chen',
    bio: 'Gym bottle always full',
    friends: [],
    daily_goal_ml: 2000,
    streak_count: 12,
  },
  {
    id: 'demo-jordan',
    email: 'jordan@waterwarrior.app',
    username: 'jordan_drops',
    full_name: 'Jordan Lee',
    bio: 'Tracking every ml',
    friends: [],
    daily_goal_ml: 3000,
    streak_count: 3,
  },
];

function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function generateId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function sortByCreatedDate(items, sort = '-created_date') {
  const desc = sort.startsWith('-');
  return [...items].sort((a, b) => {
    const aTime = new Date(a.created_date || 0).getTime();
    const bTime = new Date(b.created_date || 0).getTime();
    return desc ? bTime - aTime : aTime - bTime;
  });
}

function ensureSeedData() {
  const users = readJson(STORAGE.users, []);
  if (users.length === 0) {
    writeJson(
      STORAGE.users,
      DEMO_USERS.map((u) => ({ ...u, created_date: new Date().toISOString() }))
    );
  }
}

function getUsers() {
  ensureSeedData();
  return readJson(STORAGE.users, []);
}

function saveUsers(users) {
  writeJson(STORAGE.users, users);
}

function getCurrentUserId() {
  return localStorage.getItem(STORAGE.currentUserId);
}

function setCurrentUserId(id) {
  if (id) localStorage.setItem(STORAGE.currentUserId, id);
  else localStorage.removeItem(STORAGE.currentUserId);
}

function createGuestUser() {
  const id = generateId();
  const email = `guest_${id.slice(0, 8)}@local.waterwarrior`;
  const user = {
    id,
    email,
    username: '',
    full_name: 'Water Warrior',
    bio: '',
    friends: [],
    daily_goal_ml: 2000,
    streak_count: 0,
    last_goal_date: null,
    created_date: new Date().toISOString(),
  };
  const users = getUsers();
  users.push(user);
  saveUsers(users);
  setCurrentUserId(id);
  return user;
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function createEntityApi(storageKey, { withCreatedBy = false } = {}) {
  const load = () => readJson(storageKey, []);
  const save = (items) => writeJson(storageKey, items);

  return {
    async list(sort = '-created_date', limit = 100) {
      const items = sortByCreatedDate(load(), sort);
      return items.slice(0, limit);
    },

    async filter(query = {}, sort = '-created_date', limit = 100) {
      let items = load();
      for (const [key, value] of Object.entries(query)) {
        items = items.filter((item) => item[key] === value);
      }
      return sortByCreatedDate(items, sort).slice(0, limit);
    },

    async create(data) {
      const me = await auth.me();
      const record = {
        id: generateId(),
        ...data,
        created_date: new Date().toISOString(),
      };
      if (withCreatedBy) {
        record.created_by = me.email;
      }
      const items = load();
      items.push(record);
      save(items);
      return record;
    },

    async update(id, data) {
      const items = load();
      const index = items.findIndex((item) => item.id === id);
      if (index === -1) throw new Error('Record not found');
      items[index] = { ...items[index], ...data };
      save(items);
      return items[index];
    },

    async delete(id) {
      const items = load().filter((item) => item.id !== id);
      save(items);
    },
  };
}

const auth = {
  async ensureSession() {
    if (!getCurrentUserId()) {
      createGuestUser();
    }
  },

  async me() {
    await auth.ensureSession();
    const users = getUsers();
    const user = users.find((u) => u.id === getCurrentUserId());
    if (!user) {
      setCurrentUserId(null);
      return createGuestUser();
    }
    return { ...user };
  },

  async updateMe(updates) {
    const users = getUsers();
    const index = users.findIndex((u) => u.id === getCurrentUserId());
    if (index === -1) throw new Error('Not signed in');
    users[index] = { ...users[index], ...updates };
    saveUsers(users);
    return { ...users[index] };
  },

  logout(redirectUrl) {
    setCurrentUserId(null);
    if (redirectUrl) {
      window.location.href = redirectUrl;
    } else {
      window.location.reload();
    }
  },

  async deleteAccount() {
    const me = await auth.me();
    const users = getUsers().filter((u) => u.id !== me.id);
    saveUsers(users);
    const posts = readJson(STORAGE.posts, []).filter((p) => p.created_by !== me.email);
    writeJson(STORAGE.posts, posts);
    const bottles = readJson(STORAGE.bottles, []).filter((b) => b.user_id !== me.id);
    writeJson(STORAGE.bottles, bottles);
    const requests = readJson(STORAGE.friendRequests, []).filter(
      (r) => r.from_email !== me.email && r.to_email !== me.email
    );
    writeJson(STORAGE.friendRequests, requests);
    setCurrentUserId(null);
  },

  redirectToLogin(returnUrl) {
    auth.ensureSession().then(() => {
      if (returnUrl) window.location.href = returnUrl;
      else window.location.reload();
    });
  },
};

async function addFriendConnection(userEmail, friendEmail) {
  const users = getUsers();
  for (const user of users) {
    if (user.email === userEmail) {
      user.friends = Array.from(new Set([...(user.friends || []), friendEmail]));
    }
    if (user.email === friendEmail) {
      user.friends = Array.from(new Set([...(user.friends || []), userEmail]));
    }
  }
  saveUsers(users);
}

export const localApi = {
  auth,
  addFriendConnection,
  entities: {
    WaterPost: createEntityApi(STORAGE.posts, { withCreatedBy: true }),
    UserBottle: {
      async list() {
        const me = await auth.me();
        return readJson(STORAGE.bottles, []).filter((b) => b.user_id === me.id);
      },
      async create(data) {
        const me = await auth.me();
        const bottles = readJson(STORAGE.bottles, []);
        if (data.is_default) {
          bottles.forEach((b) => {
            if (b.user_id === me.id) b.is_default = false;
          });
        }
        const bottle = {
          id: generateId(),
          user_id: me.id,
          name: data.name,
          size_ml: data.size_ml,
          is_default: data.is_default ?? false,
          created_date: new Date().toISOString(),
        };
        bottles.push(bottle);
        writeJson(STORAGE.bottles, bottles);
        return bottle;
      },
      async update(id, data) {
        const me = await auth.me();
        const bottles = readJson(STORAGE.bottles, []);
        const index = bottles.findIndex((b) => b.id === id && b.user_id === me.id);
        if (index === -1) throw new Error('Bottle not found');
        if (data.is_default) {
          bottles.forEach((b) => {
            if (b.user_id === me.id) b.is_default = false;
          });
        }
        bottles[index] = { ...bottles[index], ...data };
        writeJson(STORAGE.bottles, bottles);
        return bottles[index];
      },
      async delete(id) {
        const me = await auth.me();
        const bottles = readJson(STORAGE.bottles, []).filter(
          (b) => !(b.id === id && b.user_id === me.id)
        );
        writeJson(STORAGE.bottles, bottles);
      },
    },
    User: {
      async list() {
        return getUsers();
      },
    },
    FriendRequest: createEntityApi(STORAGE.friendRequests),
  },
  integrations: {
    Core: {
      async UploadFile({ file }) {
        const file_url = await blobToDataUrl(file);
        return { file_url };
      },
    },
  },
};
