export type Loadable<T> = {
    type: 'idle';
} | {
    type: 'loading';
    taskId: number;
} | {
    type: 'success';
    data: T;
} | {
    type: 'error';
    msg: string;
}
