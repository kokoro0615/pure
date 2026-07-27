export type ClubRaiaPanel = "all" | "about" | "contact" | null;

export type ClubRaiaNavigationItem = {
  label: string;
  href: string;
  image: string;
};

export type ClubRaiaInfoPanelContent = {
  id: "about" | "contact";
  title: string;
  backgroundImage: string;
  tone: "warm" | "cool";
};
