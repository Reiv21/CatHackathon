export interface ShelterResponse {
  id_zewnetrzne: number;
  name: string;
  city: string;
  voivodeship: string;
  website_url: string | null;
  cat_count: number;
  latitude: number | null;
  longitude: number | null;
}

export interface CatResponse {
  id: number;
  name: string;
  description: string;
  image_url: string | null;
  source_url: string | null;
  shelter_id: number;
  shelter_name: string;
  shelter_city: string;
  shelter_url: string | null;
  shelter_voivodeship: string | null;
}

export interface ApiError {
  message: string;
}
