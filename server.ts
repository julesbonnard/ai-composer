import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { AskNewsSDK } from '@emergentmethods/asknews-typescript-sdk';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

const ask = new AskNewsSDK({
  clientId: process.env.ASKNEWS_CLIENT_ID || '',
  clientSecret: process.env.ASKNEWS_CLIENT_SECRET || '',
  scopes: ['news'],
});

app.post('/api/asknews/search', async (req, res) => {
  try {
    const { query } = req.body;

    if (!query) {
      return res.status(400).json({ error: 'Query parameter is required' });
    }

    const result = await ask.news.searchNews({
      query,
      domainUrl: ['afp.com'],
      returnType: 'both',
    });

    res.json(result);
  } catch (error: any) {
    console.error('Error fetching news:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch news' });
  }
});

app.listen(PORT, () => {
  console.log(`AskNews proxy server running on http://localhost:${PORT}`);
});
