export default function manifest() {
  return {
    name: "Міщенки",
    short_name: "Температура",
    start_url: "/",
    display: "standalone",
    background_color: "#04142b",
    theme_color: "#04142b",
    icons: [
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}