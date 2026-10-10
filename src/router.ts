import { createRouter, createWebHistory } from "vue-router"
import Home from "./App.vue"
import Sprites from "./views/SpritesView.vue"

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/", name: "home", component: Home },
    { path: "/sprites", name: "sprites", component: Sprites },
  ],
})
