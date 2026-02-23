export type MemoStore = {
  "version": "0.1.0",
  "name": "memo_store",
  "instructions": [
    {
      "name": "storeMemo",
      "accounts": [
        {
          "name": "memo",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "author",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "eventAuthority",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "program",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "args",
          "type": {
            "defined": "StoreMemoArgs"
          }
        }
      ]
    },
    {
      "name": "closeMemo",
      "accounts": [
        {
          "name": "memo",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "author",
          "isMut": true,
          "isSigner": true
        }
      ],
      "args": []
    }
  ],
  "accounts": [
    {
      "name": "memo",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "author",
            "type": "publicKey"
          },
          {
            "name": "text",
            "type": "string"
          },
          {
            "name": "timestamp",
            "type": "i64"
          },
          {
            "name": "nonce",
            "type": "u64"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    }
  ],
  "types": [
    {
      "name": "CommonFields",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "slot",
            "type": "u64"
          },
          {
            "name": "unixTimestamp",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "StoreMemoArgs",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "text",
            "type": "string"
          },
          {
            "name": "nonce",
            "type": "u64"
          }
        ]
      }
    }
  ],
  "events": [
    {
      "name": "MemoCreated",
      "fields": [
        {
          "name": "common",
          "type": {
            "defined": "CommonFields"
          },
          "index": false
        },
        {
          "name": "memo",
          "type": "publicKey",
          "index": false
        },
        {
          "name": "author",
          "type": "publicKey",
          "index": false
        },
        {
          "name": "text",
          "type": "string",
          "index": false
        }
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "TextEmpty",
      "msg": "Memo text cannot be empty"
    },
    {
      "code": 6001,
      "name": "TextTooLong",
      "msg": "Memo text exceeds 280 bytes"
    }
  ]
};

export const IDL: MemoStore = {
  "version": "0.1.0",
  "name": "memo_store",
  "instructions": [
    {
      "name": "storeMemo",
      "accounts": [
        {
          "name": "memo",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "author",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "eventAuthority",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "program",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "args",
          "type": {
            "defined": "StoreMemoArgs"
          }
        }
      ]
    },
    {
      "name": "closeMemo",
      "accounts": [
        {
          "name": "memo",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "author",
          "isMut": true,
          "isSigner": true
        }
      ],
      "args": []
    }
  ],
  "accounts": [
    {
      "name": "memo",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "author",
            "type": "publicKey"
          },
          {
            "name": "text",
            "type": "string"
          },
          {
            "name": "timestamp",
            "type": "i64"
          },
          {
            "name": "nonce",
            "type": "u64"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    }
  ],
  "types": [
    {
      "name": "CommonFields",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "slot",
            "type": "u64"
          },
          {
            "name": "unixTimestamp",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "StoreMemoArgs",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "text",
            "type": "string"
          },
          {
            "name": "nonce",
            "type": "u64"
          }
        ]
      }
    }
  ],
  "events": [
    {
      "name": "MemoCreated",
      "fields": [
        {
          "name": "common",
          "type": {
            "defined": "CommonFields"
          },
          "index": false
        },
        {
          "name": "memo",
          "type": "publicKey",
          "index": false
        },
        {
          "name": "author",
          "type": "publicKey",
          "index": false
        },
        {
          "name": "text",
          "type": "string",
          "index": false
        }
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "TextEmpty",
      "msg": "Memo text cannot be empty"
    },
    {
      "code": 6001,
      "name": "TextTooLong",
      "msg": "Memo text exceeds 280 bytes"
    }
  ]
};
