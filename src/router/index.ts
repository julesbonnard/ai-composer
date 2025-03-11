import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '@/views/HomeView.vue'
import GetStarted from '@/components/GetStarted.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomeView,
      children: [
        {
          path: '/get-started',
          name: 'get-started',
          component: GetStarted
        },
        {
          path: '/sources/:id',
          name: 'source',
          component: () => import('@/components/SourceEditor.vue')
        },
        {
          path: '/sources/new',
          name: 'new-source',
          component: () => import('@/components/SourceEditor.vue')
        }
      ]
    }
  ]
})

export default router
