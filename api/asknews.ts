import dotenv from 'dotenv';
import { AskNewsSDK } from '@emergentmethods/asknews-typescript-sdk';
import type { VercelRequest, VercelResponse } from "@vercel/node";

dotenv.config();

export default async function handler(request: VercelRequest, response: VercelResponse) {
  try {
    const {
      query,
      domainUrl,
      clientId,
      clientSecret
    } = request.body;

    const ask = new AskNewsSDK({
      clientId,
      clientSecret,
      scopes: ['news']
    });

    if (!query) {
      return response.status(400).json({ error: 'Query parameter is required' });
    }

    const result = await ask.news.searchNews({
      query,
      domainUrl,
      returnType: 'both',
    })

    return response.status(200).json(result);
  } catch (error: any) {
    console.error('Error fetching news:', error);
    return response.status(500).json({ error: error.message || 'Failed to fetch news' });
  }
};