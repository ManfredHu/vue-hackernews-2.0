import Vue from 'vue'
import 'es6-promise/auto'
import { createApp } from './app'
import ProgressBar from './components/ProgressBar.vue'

// global progress bar
const bar = Vue.prototype.$bar = new Vue(ProgressBar).$mount()
document.body.appendChild(bar.$el)

// a global mixin that calls `asyncData` when a route component's params change
Vue.mixin({
  beforeRouteUpdate (to, from, next) {
    const { asyncData } = this.$options
    if (asyncData) {
      asyncData({
        store: this.$store,
        route: to
      }).then(next).catch(next)
    } else {
      next()
    }
  }
})

const { app, router, store } = createApp()

// prime the store with server-initialized state.
// the state is determined during SSR and inlined in the page markup.
if (window.__INITIAL_STATE__) {
  store.replaceState(window.__INITIAL_STATE__)
}
console.log('entry-client exec')
// wait until router has resolved all async before hooks
// and async components...
router.onReady(() => {
  // 添加路由钩子函数，用于处理 asyncData.
  // 在初始路由 resolve 后执行，
  // 以便我们不会二次预取(double-fetch)已有的数据。
  // 使用 `router.beforeResolve()`，以便确保所有异步组件都 resolve。
  router.beforeResolve((to, from, next) => {
    // 初始化渲染不会执行
    // 页面切换执行
    console.log(`is router.beforeResolve form to`, from, to)
    const matched = router.getMatchedComponents(to)
    console.log(`is router.beforeResolve matched`, matched)
    const prevMatched = router.getMatchedComponents(from)
    console.log(`is router.beforeResolve prevMatched`, prevMatched)

    // 标识前后页面组件是否相同，只要有一个不同则全部不同
    let diffed = false
    console.log(`is router.beforeResolve`)
    const activated = matched.filter((c, i) => {
      console.log(`matched.filter`, c, i)
      console.log(`matched.filter diffed`, diffed)
      console.log(`matched.filter prevMatched[i]`, prevMatched[i], prevMatched[i] !== c)
      return diffed || (diffed = (prevMatched[i] !== c))
    })
    const asyncDataHooks = activated.map(c => c.asyncData).filter(_ => _)
    if (!asyncDataHooks.length) {
      return next()
    }

    bar.start()
    Promise.all(asyncDataHooks.map(hook => hook({ store, route: to })))
      .then(() => {
        bar.finish()
        next()
      })
      .catch(next)
  })

  // actually mount to DOM
  app.$mount('#app')
})

// service worker
if ('https:' === location.protocol && navigator.serviceWorker) {
  navigator.serviceWorker.register('/service-worker.js')
}
