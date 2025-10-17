// Camera Mapping (34 ROIs)
export const CAMERA_MAP: Record<number, string> = {
  // Boxes 1-16: Cameras 3, 5, 7, 9
  1: 'CAM3_r0_c0',
  2: 'CAM3_r0_c1',
  3: 'CAM3_r0_c2',
  4: 'CAM3_r0_c3',
  5: 'CAM5_r0_c0',
  6: 'CAM5_r0_c1',
  7: 'CAM5_r0_c2',
  8: 'CAM5_r0_c3',
  9: 'CAM7_r0_c0',
  10: 'CAM7_r0_c1',
  11: 'CAM7_r0_c2',
  12: 'CAM7_r0_c3',
  13: 'CAM9_r0_c0',
  14: 'CAM9_r0_c1',
  15: 'CAM9_r0_c2',
  16: 'CAM9_r0_c3',

  // Boxes 17-32: Cameras 2, 4, 6, 8
  17: 'CAM2_r0_c0',
  18: 'CAM2_r0_c1',
  19: 'CAM2_r0_c2',
  20: 'CAM2_r0_c3',
  21: 'CAM4_r0_c0',
  22: 'CAM4_r0_c1',
  23: 'CAM4_r0_c2',
  24: 'CAM4_r0_c3',
  25: 'CAM6_r0_c0',
  26: 'CAM6_r0_c1',
  27: 'CAM6_r0_c2',
  28: 'CAM6_r0_c3',
  29: 'CAM8_r0_c0',
  30: 'CAM8_r0_c1',
  31: 'CAM8_r0_c2',
  32: 'CAM8_r0_c3',

  // Boxes 33-34: Side indicators
  33: 'CAM1',
  34: 'CAM10',
};

export const REVERSE_CAMERA_MAP: Record<string, number> = Object.entries(CAMERA_MAP).reduce(
  (acc, [box, cam]) => ({ ...acc, [cam]: parseInt(box) }),
  {}
);

export const MAX_BATCH_QUEUE = 5;

export const SOCKET_EVENTS = {
  CONNECT: 'connect',
  DISCONNECT: 'disconnect',
  CONNECT_ERROR: 'connect_error',
  RESPONSE_MESSAGE: 'responseMessage',
} as const;
