import { apiFetch } from "../api";

export const listUsers = async () => {
  return await apiFetch("/api/users");
};

export const createUser = async (userData) => {
  return await apiFetch("/api/users", {
    method: "POST",
    body: JSON.stringify(userData),
  });
};

export const updateUser = async (userId, userData) => {
  return await apiFetch(`/api/users/${userId}`, {
    method: "PUT",
    body: JSON.stringify(userData),
  });
};

export const changeUserPassword = async (userId, newPassword) => {
  return await apiFetch(`/api/users/${userId}/password`, {
    method: "PUT",
    body: JSON.stringify({ new_password: newPassword }),
  });
};

export const deleteUser = async (userId) => {
  return await apiFetch(`/api/users/${userId}`, {
    method: "DELETE",
  });
};
