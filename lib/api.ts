import axios, { isAxiosError } from "axios";

const base_url = process.env.NEXT_PUBLIC_API_URL;


export const axiosGet = async (endpoint: string, withAuth?: boolean) => {
  try {
    const res = await axios.get(`${base_url}${endpoint}`,{withCredentials : withAuth});
    return res.data;
  } catch (error) {
    if (isAxiosError(error)) {
      throw new Error(error.response?.data?.message || error.message);
    }
    throw error;
  }
};

export const axiosPost = async (
  endpoint: string,
  data?: object,
  withAuth?: boolean,
) => {
  try {
    const res = await axios.post(`${base_url}${endpoint}`, data, {withCredentials : withAuth});
    return res.data;
  } catch (error) {
    if (isAxiosError(error)) {
      throw new Error(
        Array.isArray(error.response?.data?.message)
          ? error.response.data.message[0]
              .split('_')
              .map((word :  string) => word.charAt(0).toUpperCase() + word.slice(1))
              .join(' ')
          : error.response?.data?.message || 'An error occurred'
      );
    }
    throw error;
  }
};

export const axiosPatch = async (
  endpoint: string,
  data?: object,
  withAuth?: boolean,
) => {
  try {
    const res = await axios.patch(`${base_url}${endpoint}`, data,{withCredentials : withAuth});
    return res.data;
  } catch (error) {
    if (isAxiosError(error)) {
      throw new Error(error.response?.data?.message[0].split('_').map((word : string) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ') || error.message);
    }
    throw error;
  }
};

export const axiosPut = async (
  endpoint: string,
  data?: object,
  withAuth?: boolean,
) => {
  try {
    const res = await axios.put(`${base_url}${endpoint}`, data, {withCredentials : withAuth});
    return res.data;
  } catch (error) {
    if (isAxiosError(error)) {
      console.log(error.response?.data?.message)
      throw new Error(error.response?.data?.message[0].split('_').map((word : string) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')|| error.message);
    }
    throw error;
  }
};

export const axiosDelete = async (endpoint: string, withAuth?: boolean) => {
  try {
    const res = await axios.delete(`${base_url}${endpoint}`, {withCredentials : withAuth});
    return res.data;
  } catch (error) {
    if (isAxiosError(error)) {
      
      throw new Error(error.response?.data?.message || error.message);
    }
    throw error;
  }
};
