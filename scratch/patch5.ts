import fs from 'fs';

let content = fs.readFileSync('src/components/settings/SettingsAccountTab.tsx', 'utf-8');

const search = `                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};`;

const replace = `                )})}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};`;

content = content.replace(search, replace);
fs.writeFileSync('src/components/settings/SettingsAccountTab.tsx', content);
