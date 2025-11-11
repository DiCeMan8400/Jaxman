import webpack from 'webpack';
import path from 'path';
import fs from 'fs';
import HtmlWebpackPlugin from 'html-webpack-plugin';
import CopyWebpackPlugin from 'copy-webpack-plugin';

const { NODE_ENV, PORT } = process.env;

export default {
    entry : [
        './src/index'
    ],

    output : {
        path : path.resolve(path.dirname(''), 'dist'),
        filename : 'bundle.js'
    },

    ...(NODE_ENV === 'production' ? {
        mode : 'production'
    } : {
        mode : 'development',
        devtool : 'inline-source-map',
        devServer : {
            host : '0.0.0.0',
            port : PORT || 8080,
            setupMiddlewares: (middlewares, devServer) => {
                const app = devServer.app;
                if (!app) return middlewares;

                const dataDir = path.resolve(process.cwd(), 'data');
                const dataPath = path.resolve(dataDir, 'highscores.json');

                const ensureDir = () => {
                    try { fs.mkdirSync(dataDir, { recursive: true }); } catch (e) {}
                };
                const readScores = () => {
                    try {
                        const raw = fs.readFileSync(dataPath, 'utf-8');
                        const arr = JSON.parse(raw);
                        return Array.isArray(arr) ? arr : [];
                    } catch (e) {
                        return [];
                    }
                };
                const writeScores = (list) => {
                    ensureDir();
                    try {
                        fs.writeFileSync(dataPath, JSON.stringify(list.slice(0, 200), null, 2), 'utf-8');
                    } catch (e) {}
                };

                app.get('/api/highscores', (req, res) => {
                    const list = readScores().sort((a, b) => (b.score || 0) - (a.score || 0));
                    res.json({ ok: true, top: list.slice(0, 10) });
                });

                app.post('/api/highscores', (req, res) => {
                    let body = '';
                    req.on('data', (chunk) => { body += chunk; });
                    req.on('end', () => {
                        try {
                            const payload = JSON.parse(body || '{}');
                            const name = ((payload.name || 'Anonymous') + '').substring(0, 32);
                            const score = Math.floor(Number(payload.score) || 0);
                            const timestamp = Number(payload.timestamp) || Date.now();
                            if (!Number.isFinite(score) || score <= 0) throw new Error('Invalid score');
                            const list = readScores();
                            list.push({ name, score, timestamp });
                            list.sort((a, b) => (b.score || 0) - (a.score || 0));
                            writeScores(list);
                            res.json({ ok: true, entry: { name, score, timestamp }, top: list.slice(0, 10) });
                        } catch (e) {
                            res.status(400).json({ ok: false, error: e.message || 'Bad Request' });
                        }
                    });
                });

                return middlewares;
            }
        }
    }),

    module : {
        rules : [
            {
                test : /\.css$/,
                use : ['style-loader', 'css-loader']
            },
            {
                test: /\.(png|jpe?g|gif|svg)$/i,
                type: "asset/resource",
                generator: {
                    filename: './img/[name][ext]'
                }
            },
            {
                test: /\.(mp3)$/i,
                type: "asset/resource",
                generator: {
                    filename: './audio/[name][ext]'
                }
            },
            {
                test: /\.(woff|woff2)$/i,
                type: "asset/resource",
                generator: {
                    filename: './fonts/[name][ext]'
                }
            },
        ]
    },

    plugins : [
        new HtmlWebpackPlugin({
            template : './src/index.html',
            headTags : process.env.JSPACMAN_HEAD_TAGS
        }),
        new CopyWebpackPlugin({
            patterns : [
                {
                    from : path.resolve(path.dirname(''), 'public'),
                    to : path.resolve(path.dirname(''), 'dist')
                }
            ]
        })
    ]
};
