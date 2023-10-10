let userLang = 'en';
if (Telegram.WebApp.initDataUnsafe.user) {
  userLang = Telegram.WebApp.initDataUnsafe.user.language_code;
  if (!['ru', 'en'].includes(userLang)) {
    userLang = 'en';
  }
}
Vue.prototype.$str = Locales[userLang];
Vue.prototype.getAge = (dob) => {
  const [day, month, year] = dob.split('.').map(v => parseInt(v, 10));
  const now = new Date();
  let age = now.getFullYear() - year;
  if (now.getMonth() + 1 < month) {
    return age - 1;
  }
  if (now.getMonth() + 1 > month) {
    return age;
  }
  if (now.getDate() < day) {
    return age - 1;
  }
  return age;
}

const CardTranslateThreshold = 100;
const MaxCardTranslation = 400;
Vue.component('a-profile', {
  props: ['user', 'matches', 'isLast'],
  template: '#profile-template',
  data () {
    return {
      pos0: null,
      marginMul: 440 / MaxCardTranslation,
      rotate: 0,
      translate: [0, 0],
      opacity: 1,
      isTouch: false,
      isDragging: false,
      isAnimating: false,
      action: null,
    }
  },
  methods: {
    onDown(ev) {
      if (this.matches) {
        return;
      }
      this.marginMul = (this.$el.offsetHeight + 8) / MaxCardTranslation;
      this.isTouch = !!ev.touches;
      this.isAnimating = false;
      if (this.isTouch) {
        this.pos0 = [ev.touches[0].screenX, ev.touches[0].screenY];
        document.addEventListener('touchmove', this.onMove, { passive: false });
        document.addEventListener('touchend', this.onUp, { passive: false });
      } else {
        this.pos0 = [ev.screenX, ev.screenY];
        document.addEventListener('mousemove', this.onMove, { passive: false });
        document.addEventListener('touchcancel', this.onUp, { passive: false });
        document.addEventListener('mouseup', this.onUp, { passive: false });
      }
    },
    removeListeners() {
      if (this.isTouch) {
        document.removeEventListener('touchmove', this.onMove, { passive: false });
        document.removeEventListener('touchcancel', this.onUp, { passive: false });
        document.removeEventListener('touchend', this.onUp, { passive: false });
      } else {
        document.removeEventListener('mousemove', this.onMove, { passive: false });
        document.removeEventListener('mouseup', this.onUp, { passive: false });
      }
    },
    onMove(ev) {
      const pos = this.isTouch ? [ev.touches[0].screenX, ev.touches[0].screenY] : [ev.screenX, ev.screenY];
      const dx = pos[0] - this.pos0[0];
      const dy = pos[1] - this.pos0[1];

      if (!this.isDragging && Math.abs(dx) < 10) {
        if (Math.abs(dy) > 10) {
          this.removeListeners();
        }
        return;
      }
      
      this.isDragging = true;
      //console.log(dx, dy);
      
      this.translate = [dx, dy];
      this.rotate = dx / 20;
      ev.preventDefault();
      ev.stopPropagation();
    },
    onUp(ev) {
      this.isDragging = false;
      this.removeListeners();
      this.performAction(this.translate[0] > CardTranslateThreshold ? 'like' :
        (this.translate[0] < -CardTranslateThreshold ? 'dislike' : 0));
      //ev.preventDefault();
      //ev.stopPropagation();
    },
    performAction(action) {
      this.isAnimating = true;
      this.action = action;
      setTimeout(() => {
        if (action == 'like') {
          this.translate = [MaxCardTranslation, 100];
          this.rotate = MaxCardTranslation / 20;
          this.opacity = 0;
        } else
        if (action == 'dislike') {
          this.translate = [-MaxCardTranslation, 100];
          this.rotate = -MaxCardTranslation / 20;
          this.opacity = 0;
        } else {
          this.translate = [0, 0];
          this.rotate = 0;
        }
      }, 0);
      if (action) {
        Telegram.WebApp.HapticFeedback.impactOccurred('medium');
      }
    },
    onTransitionEnd() {
      this.isAnimating = false;
      if (this.action) {
        this.$emit('like', this.user, this.action == 'like' ? 1 : -1);
      }
    },
  },
  mounted() {
    //
  },
});

const ProfileFields = [
  ['name', 10],
  ['birthdate', 20],
  ['interests', 30],
  ['city', 40],
//  ['display_gender', 50],
  ['pronouns', 60],
  ['sexuality', 70],
  ['height', 80],
  ['weight', 90],
  ['about', 120]
];

var app = new Vue({
  el: '#app',
  data: {
    me: null,
    page: 'empty',
    prev: [],
    pos: '',

    feed: [],
    notifications: [],

    editedValue: '',

    isCouple: false,
    isLocalSearch: false,
    isProfileDirty: false,
  },
  watch: {
    editedValue(newValue) {
      const field = this.page;
      const origValue = this.me[field];
      if (origValue == newValue) {
        Telegram.WebApp.MainButton.hide();
      } else {
        Telegram.WebApp.MainButton.text = this.$str.btn_save;
        Telegram.WebApp.MainButton.show();
      }
    },
  },
  methods: {
    async api(endpoint, params = {}) {
      return (await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(Object.assign({
          initData: Telegram.WebApp.initData,
        }, params)),
      })).json();
    },
    turnPage(newPage, skipHistory) {
      if (!skipHistory && this.page != 'empty') {
        this.prev.push(this.page);
      }
      this.page = newPage;
      if (newPage == 'agreement') {
        Telegram.WebApp.MainButton.text = this.$str.btn_agree18;
        Telegram.WebApp.MainButton.show();
      } else
      if (newPage == 'gender') {
        Telegram.WebApp.MainButton.text = this.$str.btn_continue;
        Telegram.WebApp.MainButton.hide();
      } else
      if (newPage == 'lookingfor') {
        Telegram.WebApp.MainButton.hide();
      } else
      if (['settings', 'language', 'search', 'profile', 'matches'].includes(newPage)) {
        Telegram.WebApp.MainButton.hide();
        this.isProfileDirty = false;
      } else
      if (newPage == 'home') {
        this.prev = [];
        Telegram.WebApp.MainButton.hide();
      } else {
        Telegram.WebApp.MainButton.hide();
      }

      if (ProfileFields.map(([name]) => name).includes(newPage)) {
        this.editedValue = this.me[newPage] || '';
      }

      if (this.prev.length) {
        Telegram.WebApp.BackButton.show();
      } else {
        Telegram.WebApp.BackButton.hide();
      }
    },
    prevPage() {
      return this.prev[this.prev.length - 1];
    },
    popPage() {
      this.turnPage(this.prev.pop(), true);
    },
    update(fields) {
      this.me = Object.assign(this.me, fields);
      return this.api('update', fields);
    },
    async onboardingPage(page, value, skipHistory) {
      await this.update({ onboarding_step: value });
      this.turnPage(page, skipHistory);
    },
    async profilePage(page, value, skipHistory) {
      await this.update({ profile_step: value });
      this.turnPage(page, skipHistory);
    },
    async selectGender(gender) {
      if (this.me.onboarding_step < 60) {
        await this.update({ onboarding_step: 60, gender });
        this.turnPage('lookingfor');
      } else {
        await this.update({ gender });
        this.popPage();
      }
    },
    async selectLookingFor(lookingfor) {
      if (this.me.onboarding_step < 110) {
        await this.update({ onboarding_step: 110, lookingfor });
        this.turnPage('photo');
      } else {
        await this.update({ lookingfor });
        this.popPage();
      }
    },
    onBackButton() {
      this.popPage();
    },
    async onMainButton() {
      if (this.page == 'agreement') {
        this.onboardingPage('gender', 10, true);
      } else
      if (this.page == 'gender') {
        this.onboardingPage('lookingfor', 60);
      } else
      if (this.page == 'lookingfor') {
        this.onboardingPage('home', 120);
      }
      for (let i = 0; i < ProfileFields.length; i++) {
        const [name, step] = ProfileFields[i];
        if (this.page == name) {
          await this.update({ [name]: this.editedValue });
          if (this.me.profile_step < 120) {
            this.profilePage(i < ProfileFields.length - 1 ? ProfileFields[i + 1][0] : 'home', step);
          } else {
            this.popPage();
          }
        }
      }
    },
    async onSelectPhoto(ev) {
      if (!ev.target.files[0]) {
        return;
      }
      const fd = new FormData();
      fd.append('file', ev.target.files[0]);
      fd.append('initData', Telegram.WebApp.initData);
      const result = await (await fetch('upload', {
        method: 'POST',
        body: fd
      })).json();

      ev.target.value = '';
      this.me.photo_id = result.id;
      if (this.me.onboarding_step < 120) {
        this.onboardingPage('home', 120);
      } else {
        //this.popPage();
      }
    },
    async search(isLocal) {
      this.isLocalSearch = isLocal;

      if (isLocal) {
        navigator.geolocation.getCurrentPosition(async (pos) => {
          this.feed = (await this.api('search', { local: true, latitude: pos.coords.latitude, longitude: pos.coords.longitude })).feed;
          this.turnPage('search');
        }, (err) => {
          //
        });
      } else {
        this.feed = (await this.api('search', { local: false })).feed;
        this.turnPage('search');
      }
    },
    async like(user, likeType) {
      for (let i = 0; i < this.feed.length; i++) {
        if (this.feed[i].id == user.id) {
          this.feed.splice(i, 1);
          break;
        }
      }
      const result = await this.api('like', { id: user.id, type: likeType });
      if (result.mutual) {
        this.notifications.push({
          user: result.mutual,
        });

        setTimeout(() => {
          this.notifications = this.notifications.filter(notif => notif.user.id != result.mutual.id);
        }, 5000);
      }
    },
    activateNotification(notif) {
      Telegram.WebApp.openTelegramLink(`https://t.me/${notif.user.username}`);
    },
    editProfile() {
      for (let [name, step] of ProfileFields) {
        if (this.me.profile_step < step) {
          this.turnPage(name);
          return;
        }
      }
      this.turnPage('profile');
    },
    async showMatches() {
      this.feed = (await this.api('matches', { local: false })).feed;
      this.turnPage('matches');
    },
    toggleHidden() {
      this.update({ hide_profile: this.me.hide_profile ? 0 : 1 });
    },
    async setLang(lang) {
      await this.update({ lang });
      Vue.prototype.$str = Locales[this.me.lang];
      this.turnPage('home');
    },
    deleteAccount() {
      Telegram.WebApp.showPopup({
        title: this.$str.msg_areyousure,
        message: this.$str.msg_deactivate,
        buttons: [{ id: 'delete', type: 'destructive', text: this.$str.btn_deactivate }, { id: 'cancel', type: 'cancel' }],
      }, async action => {
        if (action == 'delete') {
          await this.api('delete');
          Telegram.WebApp.close();
        }
      });
    },
  },
  async mounted() {
    this.me = (await this.api('init')).user;
    Vue.prototype.$str = Locales[this.me.lang];

    if (this.me.onboarding_step < 10) {
      this.turnPage('agreement', true);
    } else
    if (this.me.onboarding_step < 60) {
      this.turnPage('gender', true);
    } else
    if (this.me.onboarding_step < 110) {
      this.turnPage('lookingfor', true);
    } else 
    if (this.me.onboarding_step < 120) {
      this.turnPage('photo', true);
    } else {
      this.turnPage('home', true);
    }
  }
});

Telegram.WebApp.MainButton.onClick(app.onMainButton);
Telegram.WebApp.BackButton.onClick(app.onBackButton);
document.body.classList.add('is-' + Telegram.WebApp.colorScheme);