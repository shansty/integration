import axios from 'axios';
import { Request } from 'express';

const api = axios.create({
  baseURL: process.env.BRIVO_BASE_URL,
  timeout: Number(process.env.BRIVO_TIMEOUT_MS) || 5000,
});

function withAuth(req: Request) {
  return {
    headers: {
      Authorization: (req as any).incomingAuthHeader,
    },
  };
}

export const brivo = {
  async listPeople(req: Request) {
    return (await api.get('/people', withAuth(req))).data;
  },
  async getPerson(req: Request, id: number | string) {
    return (await api.get(`/people/${id}`, withAuth(req))).data;
  },
  async createPerson(req: Request, payload: any) {
    return (await api.post('/people', payload, withAuth(req))).data;
  },
  async updatePerson(req: Request, id: number | string, payload: any) {
    return (await api.patch(`/people/${id}`, payload, withAuth(req))).data;
  },
  async deletePerson(req: Request, id: number | string) {
    return (await api.delete(`/people/${id}`, withAuth(req))).data;
  },

  async listGroups(req: Request) {
    return (await api.get('/groups', withAuth(req))).data;
  },
  async getGroup(req: Request, id: number | string) {
    return (await api.get(`/groups/${id}`, withAuth(req))).data;
  },
  async createGroup(req: Request, payload: any) {
    return (await api.post('/groups', payload, withAuth(req))).data;
  },
  async updateGroup(req: Request, id: number | string, payload: any) {
    return (await api.patch(`/groups/${id}`, payload, withAuth(req))).data;
  },
  async deleteGroup(req: Request, id: number | string) {
    return (await api.delete(`/groups/${id}`, withAuth(req))).data;
  },
};
