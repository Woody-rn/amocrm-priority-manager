export interface CloudFile {
    name: string;
    path: string;
    size: number;
    modified: string;
}

export interface ICloudStorage {
    readonly id: string;
    readonly name: string;

    connect(): Promise<void>;
    disconnect(): Promise<void>;
    isConnected(): Promise<boolean>;

    upload(data: string, filename: string): Promise<void>;
    listBackups(): Promise<CloudFile[]>;
    download(path: string): Promise<string | null>;
}