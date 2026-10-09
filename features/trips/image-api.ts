import { createDiagnosticLogger } from "../diagnostics";
import type { TripPlaceExternalImage } from "./types";

const imageApiLogger = createDiagnosticLogger("image-api");

const UNSPLASH_ACCESS_KEY = process.env.EXPO_PUBLIC_UNSPLASH_ACCESS_KEY ?? "";
const PIXABAY_API_KEY = process.env.EXPO_PUBLIC_PIXABAY_API_KEY ?? "";

const MAX_IMAGES_PER_API = 20;

const REQUEST_TIMEOUT_MS = 10000;

async function fetchWithTimeout(
  url: string,
  options?: RequestInit,
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

type UnsplashPhoto = {
  id: string;
  urls: {
    raw: string;
    full: string;
    regular: string;
    small: string;
    thumb: string;
  };
  width: number;
  height: number;
  user: {
    name: string;
    links: {
      html: string;
    };
  };
  links: {
    html: string;
  };
  description?: string;
  alt_description?: string;
};

type UnsplashSearchResponse = {
  total: number;
  total_pages: number;
  results: UnsplashPhoto[];
};

async function searchUnsplash(
  query: string,
  count = MAX_IMAGES_PER_API,
): Promise<TripPlaceExternalImage[]> {
  try {
    const encodedQuery = encodeURIComponent(query);
    const url = `https://api.unsplash.com/search/photos?query=${encodedQuery}&per_page=${count}&orientation=landscape`;

    const response = await fetchWithTimeout(url, {
      headers: {
        Authorization: `Client-ID ${UNSPLASH_ACCESS_KEY}`,
        "Accept-Version": "v1",
      },
    });

    if (!response.ok) {
      imageApiLogger.warn(
        "unsplash.request.failed",
        { status: response.status },
        "Unsplash image request failed",
      );
      return [];
    }

    const data: UnsplashSearchResponse = await response.json();

    return data.results.map((photo) => ({
      id: `unsplash-${photo.id}`,
      url: photo.urls.regular,
      source: "Unsplash",
      author: photo.user.name,
      authorUrl: photo.user.links.html,
    }));
  } catch (error) {
    imageApiLogger.warn(
      "unsplash.search.failed",
      { error },
      "Unsplash image search failed",
    );
    return [];
  }
}

type PixabayHit = {
  id: number;
  webformatURL: string;
  largeImageURL: string;
  previewURL: string;
  imageWidth: number;
  imageHeight: number;
  user: string;
  pageURL: string;
  tags: string;
};

type PixabaySearchResponse = {
  total: number;
  totalHits: number;
  hits: PixabayHit[];
};

async function searchPixabay(
  query: string,
  count = MAX_IMAGES_PER_API,
): Promise<TripPlaceExternalImage[]> {
  try {
    const encodedQuery = encodeURIComponent(query);
    const url = `https://pixabay.com/api/?key=${PIXABAY_API_KEY}&q=${encodedQuery}&image_type=photo&orientation=horizontal&per_page=${count}&safesearch=true`;

    const response = await fetchWithTimeout(url);

    if (!response.ok) {
      imageApiLogger.warn(
        "pixabay.request.failed",
        { status: response.status },
        "Pixabay image request failed",
      );
      return [];
    }

    const data: PixabaySearchResponse = await response.json();

    return data.hits.map((hit) => ({
      id: `pixabay-${hit.id}`,
      url: hit.webformatURL,
      source: "Pixabay",
      author: hit.user,
      authorUrl: hit.pageURL,
    }));
  } catch (error) {
    imageApiLogger.warn(
      "pixabay.search.failed",
      { error },
      "Pixabay image search failed",
    );
    return [];
  }
}

export async function searchPlaceImages(
  placeName: string,
  cityName?: string,
  count = MAX_IMAGES_PER_API,
): Promise<TripPlaceExternalImage[]> {
  const query = cityName ? `${placeName} ${cityName}` : placeName;

  const [unsplashResults, pixabayResults] = await Promise.all([
    searchUnsplash(query, count),
    searchPixabay(query, count),
  ]);

  const allImages = [...unsplashResults, ...pixabayResults];

  const uniqueImages = allImages.filter(
    (image, index, self) =>
      index === self.findIndex((img) => img.url === image.url),
  );

  return uniqueImages;
}

export async function fetchNewPlaceImages(
  placeName: string,
  cityName?: string,
  cachedUrls: string[] = [],
): Promise<TripPlaceExternalImage[]> {
  const allImages = await searchPlaceImages(placeName, cityName);

  const newImages = allImages.filter(
    (image) => !cachedUrls.includes(image.url),
  );

  return newImages;
}
