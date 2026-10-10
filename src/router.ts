import { createRouter, createWebHistory } from "vue-router"
import Home from "./App.vue"
import MotionE2e from "./views/MotionE2eView.vue"
import Sprites from "./views/SpritesView.vue"

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/", name: "home", component: Home },
    { path: "/sprites", name: "sprites", component: Sprites },
    { path: "/e2e", name: "e2e", component: MotionE2e },
  ],
})
