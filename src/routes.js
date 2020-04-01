import News from "./News.svelte";
import Home from "./Home.svelte";
import Pubs from "./Pubs.svelte";
import Paper from "./Paper.svelte";
import Cv from "./Cv.svelte";

export default {
  "/": Home,
  "/news": News,
  "/pubs": Pubs,
  "/cv": Cv,
  "/paper/:id": Paper
};
