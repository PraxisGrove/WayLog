import { Platform } from "react-native";

import { AmapPreviewMap as NativeAmapPreviewMap } from "./amap-preview-map.native";
import { AmapPreviewMap as WebAmapPreviewMap } from "./amap-preview-map.web";

export const AmapPreviewMap =
  Platform.OS === "web" ? WebAmapPreviewMap : NativeAmapPreviewMap;
